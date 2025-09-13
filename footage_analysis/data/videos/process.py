from __future__ import annotations
import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import math
import logging
import random
from dataclasses import dataclass
import numpy as np
import cv2


logger = logging.getLogger("angles.process")
logger.addHandler(logging.NullHandler())


def setup_logging(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    fh = logging.FileHandler(str(log_file))
    fh.setLevel(logging.INFO)
    fh.setFormatter(fmt)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    logger.addHandler(fh)
    logger.addHandler(ch)


def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


@dataclass
class VideoMeta:
    width: int
    height: int
    fps: float
    frame_count: int


def read_video_meta(video_path: str | Path) -> VideoMeta:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    return VideoMeta(width=width, height=height, fps=fps, frame_count=frame_count)


def clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def compute_crop(
    frame_w: int,
    frame_h: int,
    center_xy: Tuple[float, float],
    zoom: float,
    offset_frac: Tuple[float, float],
) -> Tuple[int, int, int, int]:
    crop_w = int(round(frame_w / max(1.0, zoom)))
    crop_h = int(round(frame_h / max(1.0, zoom)))
    crop_w = max(16, min(frame_w, crop_w))
    crop_h = max(16, min(frame_h, crop_h))

    cx, cy = center_xy
    ox = offset_frac[0] * crop_w
    oy = offset_frac[1] * crop_h
    cx_off = cx + ox
    cy_off = cy + oy

    x1 = int(round(cx_off - crop_w / 2))
    y1 = int(round(cy_off - crop_h / 2))
    x1 = int(clamp(x1, 0, frame_w - crop_w))
    y1 = int(clamp(y1, 0, frame_h - crop_h))
    x2 = x1 + crop_w
    y2 = y1 + crop_h
    return x1, y1, x2, y2


def write_angle_clip(
    source_video: str | Path,
    out_path: str | Path,
    zoom: float,
    offset_frac: Tuple[float, float],
    target_seconds: float,
    freeze_start_seconds: float,
    start_seconds: float,
    contrast_alpha: float = 1.0,
    brightness_beta: float = 0.0,
    gamma: float = 1.0,
    saturation_scale: float = 1.0,
    freeze_noise_std: float = 0.0,
    center_xy: Tuple[float, float] | None = None,
) -> None:
    meta = read_video_meta(source_video)
    cap = cv2.VideoCapture(str(source_video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {source_video}")

    fps = meta.fps
    target_frames = int(round(target_seconds * fps))
    freeze_start_frames = int(round(max(0.0, freeze_start_seconds) * fps))

    if center_xy is None:
        center_xy = (meta.width / 2.0, meta.height / 2.0)

    x1 = y1 = x2 = y2 = 0
    first_processed = None
    last_processed = None

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, fps, (meta.width, meta.height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not open writer: {out_path}")

    # clamp and seek to start
    total_secs = (meta.frame_count / max(1.0, fps)) if meta.frame_count > 0 else 0.0
    safe_start = start_seconds
    if total_secs > 0.0:
        safe_start = clamp(start_seconds, 0.0, max(0.0, total_secs - 0.2))
    if safe_start > 0:
        cap.set(cv2.CAP_PROP_POS_MSEC, safe_start * 1000.0)

    # read first frame and compute crop box; retry with frame index and then fallback to 0s
    ok, frame = cap.read()
    if not ok and safe_start > 0:
        idx = int(round(safe_start * fps))
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, idx))
        ok, frame = cap.read()
    if not ok:
        cap.release()
        cap = cv2.VideoCapture(str(source_video))
        ok, frame = cap.read()
    if not ok:
        writer.release()
        cap.release()
        raise RuntimeError("no frames in source video (seek failed and start failed)")

    if x2 == 0 and y2 == 0:
        x1, y1, x2, y2 = compute_crop(meta.width, meta.height, center_xy, zoom, offset_frac)

    logger.info(
        f"start clip -> out={out_path.name} start={safe_start:.2f}s zoom={zoom:.2f} "
        f"offset=({offset_frac[0]:+.2f},{offset_frac[1]:+.2f}) target={target_seconds:.2f}s freeze_start={freeze_start_seconds:.2f}s "
        f"crop=({x1},{y1},{x2},{y2}) alpha={contrast_alpha:.2f} beta={brightness_beta:.1f} gamma={gamma:.2f} sat={saturation_scale:.2f}"
    )

    crop = frame[y1:y2, x1:x2]
    processed = cv2.resize(crop, (meta.width, meta.height), interpolation=cv2.INTER_LINEAR)
    processed = apply_augmentations(processed, contrast_alpha, brightness_beta, gamma, saturation_scale)
    first_processed = processed
    last_processed = first_processed.copy()

    # minimal freeze at start (optional noise)
    for _ in range(min(freeze_start_frames, target_frames)):
        if freeze_noise_std > 0.0:
            writer.write(add_gaussian_noise(first_processed, freeze_noise_std))
        else:
            writer.write(first_processed)

    written = freeze_start_frames

    # collect processed frames
    processed_frames: List[np.ndarray] = [first_processed]
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        crop = frame[y1:y2, x1:x2]
        processed = cv2.resize(crop, (meta.width, meta.height), interpolation=cv2.INTER_LINEAR)
        processed = apply_augmentations(processed, contrast_alpha, brightness_beta, gamma, saturation_scale)
        processed_frames.append(processed)

    # build ping-pong sequence
    if len(processed_frames) == 0:
        processed_frames = [first_processed]
    pingpong = processed_frames + processed_frames[-2:0:-1] if len(processed_frames) > 1 else processed_frames

    # write until target length is reached
    report_every = max(1, int(meta.fps * 10))  # ~every 10 seconds
    idx_pp = 0
    while written < target_frames:
        frm = pingpong[idx_pp]
        writer.write(frm)
        last_processed = frm
        written += 1
        idx_pp = (idx_pp + 1) % len(pingpong)
        if written % report_every == 0:
            logger.info(f"progress {out_path.name}: {written}/{target_frames} frames")

    writer.release()
    cap.release()
    logger.info(f"done clip -> out={out_path.name}")


def apply_augmentations(
    bgr: np.ndarray,
    alpha: float,
    beta: float,
    gamma: float,
    saturation_scale: float,
) -> np.ndarray:
    # contrast/brightness
    img = cv2.convertScaleAbs(bgr, alpha=float(alpha), beta=float(beta))
    # gamma
    if abs(gamma - 1.0) > 1e-3:
        inv_g = 1.0 / max(1e-6, gamma)
        table = (np.linspace(0, 1, 256) ** inv_g) * 255.0
        lut = np.clip(table, 0, 255).astype(np.uint8)
        img = cv2.LUT(img, lut)
    # saturation
    if abs(saturation_scale - 1.0) > 1e-3:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        s = np.clip(s.astype(np.float32) * float(saturation_scale), 0, 255).astype(np.uint8)
        hsv = cv2.merge([h, s, v])
        img = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    return img


def add_gaussian_noise(img: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0.0:
        return img
    noise = np.random.normal(0.0, sigma, img.shape).astype(np.float32)
    out = img.astype(np.float32) + noise
    return np.clip(out, 0, 255).astype(np.uint8)


@dataclass
class Variation:
    zoom: float
    offset: Tuple[float, float]
    freeze_s: float
    start_frac: float  # 0..1 position within the source video
    alpha: float  # contrast
    beta: float   # brightness
    gamma: float
    sat: float
    freeze_noise_std: float


def per_video_variations() -> List[Variation]:
    # Four diverse variations per source video (emphasis on zoom/angle; light freeze)
    return [
        Variation(zoom=1.0, offset=(0.00, 0.00), freeze_s=2.0, start_frac=0.05, alpha=1.05, beta=3.0, gamma=1.00, sat=1.05, freeze_noise_std=0.3),
        Variation(zoom=1.6, offset=(-0.28, -0.10), freeze_s=2.5, start_frac=0.30, alpha=1.15, beta=0.0, gamma=1.05, sat=0.95, freeze_noise_std=0.4),
        Variation(zoom=2.2, offset=(0.32, 0.00), freeze_s=1.5, start_frac=0.55, alpha=1.08, beta=8.0, gamma=0.95, sat=1.10, freeze_noise_std=0.3),
        Variation(zoom=1.9, offset=(0.00, 0.30), freeze_s=2.0, start_frac=0.80, alpha=1.10, beta=-3.0, gamma=1.02, sat=0.92, freeze_noise_std=0.5),
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate varied time-splice clips with angles and color tuning.")
    parser.add_argument("--video", default=None, help="Optional single source video path")
    parser.add_argument("--in_dir", default=str(Path(__file__).resolve().parents[2] / "data" / "videos" / "kirk" / "raw"), help="Input directory of videos")
    parser.add_argument("--out_dir", default=str(Path(__file__).resolve().parents[2] / "data" / "videos" / "kirk" / "processed"), help="Output directory root")
    parser.add_argument("--per_video", type=int, default=4, help="Variants per source video")
    parser.add_argument("--duration", type=float, default=120.0, help="Duration of each clip in seconds")
    parser.add_argument("--center", default=None, help="Optional center point 'x,y' in pixels for zoom center")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")

    args = parser.parse_args()

    random.seed(args.seed)

    # Resolve input set
    sources: List[Path] = []
    if args.video:
        p = Path(args.video)
        if not p.exists():
            raise FileNotFoundError(f"Video not found: {p}")
        sources = [p]
    else:
        in_dir = Path(args.in_dir)
        if not in_dir.exists():
            raise FileNotFoundError(f"Input directory not found: {in_dir}")
        sources = sorted([p for p in in_dir.glob("*.mp4") if p.is_file()])
        if not sources:
            raise SystemExit(f"No .mp4 found in {in_dir}")

    out_root = ensure_dir(Path(args.out_dir))
    log_root = Path(args.in_dir) if not args.video else Path(args.video).parent
    setup_logging(Path(log_root) / "process.log")

    logger.info(f"found {len(sources)} source videos; writing outputs to {out_root}; log at {Path(log_root) / 'process.log'}")

    total_outputs: List[str] = []
    global_manifest_items = []
    per_vars = per_video_variations()
    if args.per_video != len(per_vars):
        # If user asks a different count, sample or extend deterministically
        if args.per_video < len(per_vars):
            per_vars = per_vars[: args.per_video]
        else:
            needed = args.per_video - len(per_vars)
            for i in range(needed):
                base = per_vars[i % len(per_vars)]
                # Slightly jitter parameters
                per_vars.append(
                    Variation(
                        zoom=min(3.0, max(1.0, base.zoom + random.uniform(-0.1, 0.1))),
                        offset=(base.offset[0] + random.uniform(-0.05, 0.05), base.offset[1] + random.uniform(-0.05, 0.05)),
                        freeze_s=max(0.0, base.freeze_s + random.uniform(-2.0, 2.0)),
                        start_frac=min(0.95, max(0.0, base.start_frac + random.uniform(-0.1, 0.1))),
                        alpha=min(1.4, max(0.6, base.alpha + random.uniform(-0.1, 0.1))),
                        beta=max(-20.0, min(20.0, base.beta + random.uniform(-5.0, 5.0))),
                        gamma=min(1.3, max(0.7, base.gamma + random.uniform(-0.1, 0.1))),
                        sat=min(1.3, max(0.7, base.sat + random.uniform(-0.1, 0.1))),
                    )
                )

    for src in sources:
        meta = read_video_meta(src)
        if args.center:
            xs = args.center.split(",")
            if len(xs) != 2:
                raise ValueError("--center must be 'x,y' in pixels")
            center_xy = (float(xs[0]), float(xs[1]))
        else:
            center_xy = (meta.width / 2.0, meta.height / 2.0)

        video_out_dir = out_root  # flat output directory, no per-video subfolders
        logger.info(f"processing {src.name} ({meta.width}x{meta.height} @ {meta.fps:.2f} fps); variants={len(per_vars)} -> out {video_out_dir}")

        for idx, var in enumerate(per_vars):
            start_sec = float(var.start_frac) * (meta.frame_count / max(1.0, meta.fps))
            safe_name = (
                f"{src.stem}_v{idx:02d}_start{var.start_frac:.2f}_zoom{var.zoom:.1f}_ox{var.offset[0]:+.2f}_oy{var.offset[1]:+.2f}"
            ).replace(".", "p").replace("-", "m").replace("+", "p")
            out_path = video_out_dir / f"{safe_name}.mp4"
            try:
                write_angle_clip(
                    source_video=src,
                    out_path=out_path,
                    zoom=var.zoom,
                    offset_frac=var.offset,
                    target_seconds=args.duration,
                    freeze_start_seconds=var.freeze_s,
                    start_seconds=start_sec,
                    contrast_alpha=var.alpha,
                    brightness_beta=var.beta,
                    gamma=var.gamma,
                    saturation_scale=var.sat,
                    freeze_noise_std=var.freeze_noise_std,
                    center_xy=center_xy,
                )
            except Exception as e:
                logger.exception(f"failed to generate {out_path.name}: {e}")
                continue
            total_outputs.append(str(out_path))
            global_manifest_items.append({
                "source": str(src),
                "file": str(out_path),
                "start_seconds": start_sec,
                "zoom": var.zoom,
                "offset_frac": [var.offset[0], var.offset[1]],
                "freeze_start_seconds": var.freeze_s,
                "alpha": var.alpha,
                "beta": var.beta,
                "gamma": var.gamma,
                "sat": var.sat,
                "freeze_noise_std": var.freeze_noise_std,
            })

    manifest = {
        "outputs_count": len(total_outputs),
        "outputs": global_manifest_items,
    }
    with open(out_root / "manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    logger.info(f"completed. {len(total_outputs)} clips written to {out_root}. manifest at {out_root / 'manifest.json'}")


if __name__ == "__main__":
    main()