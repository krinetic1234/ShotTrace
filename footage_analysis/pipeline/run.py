from __future__ import annotations
from pathlib import Path
from typing import List, Dict
import cv2
from tqdm import tqdm
import logging

from ..schemas import FrameResult, ClipSummary, VideoSummary, Detection
from ..utils import ensure_dir, ms_from_frames, write_json, prompts
from ..utils.context import build_clip_context, build_video_context
from .chunker import chunk_video
from .tracker import SimpleTracker
from ..models.yolo import YoloDetector
from ..models.vlm import VisionLLM
from ..models.llm import synthesize_text


logger = logging.getLogger("pipeline.run")
logger.addHandler(logging.NullHandler())


def process_chunk(meta: Dict, cfg: Dict, yolo: YoloDetector, vlm: VisionLLM, video_path: str) -> ClipSummary:
    logger.info(f"start chunk {meta['index']} {meta['start_sec']}..{meta['end_sec']}s -> {meta['chunk_path']}")
    cap = cv2.VideoCapture(meta["chunk_path"])
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    stride = max(1, int(cfg["frame_stride"]))
    vlm_stride = max(1, int(cfg["vlm_every_n_frames"]))
    vlm_interval_s = float(cfg.get("vlm_interval_seconds", 10))
    last_vlm_t = -1e9
    frames_for_vlm: List = []
    tracker = SimpleTracker(cfg["track_iou_threshold"], cfg["track_max_age_frames"])
    frames: List[FrameResult] = []

    frame_idx = 0
    analyzed_idx = 0
    pbar = tqdm(total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0), desc=f"chunk {meta['index']}", leave=False)

    enable_vlm = bool(cfg.get("enable_vlm", True))
    enable_llm = bool(cfg.get("enable_llm", True))

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        pbar.update(1)

        if frame_idx % stride != 0:
            frame_idx += 1
            continue

        dets: List[Detection] = yolo.infer(frame)
        dets = tracker.update(dets)

        # compute ms first to avoid unbound usage below
        ms = ms_from_frames(frame_idx, fps)

        vlm_json = None
        if enable_vlm:
            frames_for_vlm.append(frame)
            cur_t = meta["start_sec"] + (ms / 1000.0)
            if cur_t - last_vlm_t >= vlm_interval_s:
                try:
                    vlm_json = vlm.describe_batch(frames_for_vlm)
                except Exception as e:
                    logger.info(f"vlm describe failed: {e}")
                    vlm_json = None
                frames_for_vlm = []
                last_vlm_t = cur_t
        frames.append(
            FrameResult(
                frame_index=frame_idx, ms_from_chunk_start=ms, detections=dets, vlm_json=vlm_json
            )
        )

        analyzed_idx += 1
        frame_idx += 1
        if len(frames) >= cfg["max_frames_per_chunk"]:
            break

    cap.release()
    tracklets = tracker.summarize()

    # build compact text context for the LLM (no images)
    clip_ctx = build_clip_context(frames, seconds=meta["end_sec"] - meta["start_sec"]) if enable_llm else None
    synopsis = synthesize_text(f"Context JSON: {clip_ctx}\n\n{prompts.CLIP_SYNOPSIS}", cfg) if enable_llm else ""

    cs = ClipSummary(
        video_path=video_path,
        chunk_path=meta["chunk_path"],
        chunk_index=meta["index"],
        start_sec=meta["start_sec"],
        end_sec=meta["end_sec"],
        frames=frames,
        tracklets=tracklets,
        synopsis=synopsis or None,
    )
    logger.info(f"done chunk {meta['index']} frames={len(frames)} tracks={len(tracklets)}")
    return cs


def process_video(video_path: str, cfg: Dict) -> VideoSummary:
    logger.info(f"process video {video_path}")
    chunks_meta = chunk_video(video_path, cfg["artifacts_dir"], cfg["chunk_seconds"])
    yolo = YoloDetector(cfg["yolo_weights"], cfg["target_classes"], cfg["conf_threshold"])
    vlm = VisionLLM(cfg)
    enable_llm = bool(cfg.get("enable_llm", True))

    # ensure summaries dir upfront so partial results appear even if interrupted
    out_dir = ensure_dir(Path(cfg["artifacts_dir"]) / "summaries" / Path(video_path).stem)

    clip_summaries: List[ClipSummary] = []
    for meta in chunks_meta:
        try:
            clip = process_chunk(meta, cfg, yolo, vlm, video_path)
            clip_summaries.append(clip)
            # write each clip summary incrementally
            write_json(clip.model_dump(), out_dir / f"clip_{clip.chunk_index:05d}.json")
        except Exception as e:
            logger.exception(f"failed processing chunk {meta.get('index')}: {e}")
            continue

    timeline: List[Dict] = []
    for clip in clip_summaries:
        for fr in clip.frames[-5:]:
            for det in fr.detections:
                if det.track_id is None:
                    continue
                timeline.append(
                    {
                        "t_abs_sec": clip.start_sec + fr.ms_from_chunk_start / 1000.0,
                        "chunk": clip.chunk_index,
                        "track_id": det.track_id,
                        "cls": det.cls,
                        "conf": det.conf,
                    }
                )

    video_ctx = build_video_context(clip_summaries, timeline) if enable_llm else None
    narrative = synthesize_text(f"Context JSON: {video_ctx}\n\n{prompts.VIDEO_NARRATIVE}", cfg) if enable_llm else ""

    vs = VideoSummary(
        video_path=video_path,
        clip_summaries=clip_summaries,
        combined_timeline=timeline,
        narrative=narrative or None,
    )

    # write primary summary only (job-level will produce combined responder report)
    write_json(vs.model_dump(), out_dir / "video_summary.json")
    logger.info(f"done video {video_path} chunks={len(clip_summaries)} -> {out_dir}")
    return vs



