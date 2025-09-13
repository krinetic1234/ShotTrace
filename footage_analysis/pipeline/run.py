from __future__ import annotations
from pathlib import Path
from typing import List, Dict
import cv2
from tqdm import tqdm

from ..schemas import FrameResult, ClipSummary, VideoSummary, Detection
from ..utils import ensure_dir, ms_from_frames, write_json, prompts
from .chunker import chunk_video
from .tracker import SimpleTracker
from ..models.yolo import YoloDetector
from ..models.vlm import VisionLLM
from ..models.llm import synthesize_text


def process_chunk(meta: Dict, cfg: Dict, yolo: YoloDetector, vlm: VisionLLM, video_path: str) -> ClipSummary:
    cap = cv2.VideoCapture(meta["chunk_path"])
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    stride = max(1, int(cfg["frame_stride"]))
    vlm_stride = max(1, int(cfg["vlm_every_n_frames"]))
    tracker = SimpleTracker(cfg["track_iou_threshold"], cfg["track_max_age_frames"])
    frames: List[FrameResult] = []

    frame_idx = 0
    analyzed_idx = 0
    pbar = tqdm(total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0), desc=f"chunk {meta['index']}", leave=False)

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

        vlm_json = None
        if analyzed_idx % vlm_stride == 0:
            vlm_json = vlm.describe(frame, prompts.VLM_FRAME_JSON)

        ms = ms_from_frames(frame_idx, fps)
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

    synopsis = synthesize_text(prompts.CLIP_SYNOPSIS)

    return ClipSummary(
        video_path=video_path,
        chunk_path=meta["chunk_path"],
        chunk_index=meta["index"],
        start_sec=meta["start_sec"],
        end_sec=meta["end_sec"],
        frames=frames,
        tracklets=tracklets,
        synopsis=synopsis or None,
    )


def process_video(video_path: str, cfg: Dict) -> VideoSummary:
    chunks_meta = chunk_video(video_path, cfg["artifacts_dir"], cfg["chunk_seconds"])
    yolo = YoloDetector(cfg["yolo_weights"], cfg["target_classes"], cfg["conf_threshold"])
    vlm = VisionLLM()

    clip_summaries: List[ClipSummary] = []
    for meta in chunks_meta:
        clip_summaries.append(process_chunk(meta, cfg, yolo, vlm, video_path))

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

    narrative = synthesize_text(prompts.VIDEO_NARRATIVE)

    vs = VideoSummary(
        video_path=video_path,
        clip_summaries=clip_summaries,
        combined_timeline=timeline,
        narrative=narrative or None,
    )

    out_dir = ensure_dir(Path(cfg["artifacts_dir"]) / "summaries" / Path(video_path).stem)
    write_json(vs.model_dump(), out_dir / "video_summary.json")
    for clip in clip_summaries:
        write_json(clip.model_dump(), out_dir / f"clip_{clip.chunk_index:05d}.json")
    return vs



