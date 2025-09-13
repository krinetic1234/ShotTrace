from __future__ import annotations
from typing import List, Dict, Optional
from pydantic import BaseModel

class Detection(BaseModel):
    cls: str
    conf: float
    bbox_xyxy: List[float]
    track_id: Optional[int] = None

class FrameResult(BaseModel):
    frame_index: int
    ms_from_chunk_start: int
    detections: List[Detection]
    vlm_json: Optional[Dict] = None

class ClipSummary(BaseModel):
    video_path: str
    chunk_path: str
    chunk_index: int
    start_sec: float
    end_sec: float
    frames: List[FrameResult]
    tracklets: Dict[int, Dict]
    synopsis: Optional[str] = None

class VideoSummary(BaseModel):
    video_path: str
    clip_summaries: List[ClipSummary]
    combined_timeline: List[Dict]
    narrative: Optional[str] = None
