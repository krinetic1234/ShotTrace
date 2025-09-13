from __future__ import annotations
from typing import List, Dict
from ..schemas import Detection
from ..utils import iou_xyxy


class SimpleTracker:
    def __init__(self, iou_threshold: float = 0.4, max_age_frames: int = 45):
        self.iou_threshold = iou_threshold
        self.max_age = max_age_frames
        self.tracks: Dict[int, Dict] = {}
        self.next_id = 1

    def update(self, detections: List[Detection]) -> List[Detection]:
        for tid in list(self.tracks):
            self.tracks[tid]["age"] += 1
            if self.tracks[tid]["age"] > self.max_age:
                del self.tracks[tid]

        used = set()
        for d in detections:
            best_tid, best_iou = None, 0.0
            for tid, tr in self.tracks.items():
                if tr["cls"] != d.cls:
                    continue
                iou = iou_xyxy(tr["bbox"], d.bbox_xyxy)
                if iou > best_iou:
                    best_iou, best_tid = iou, tid
            if best_tid and best_iou >= self.iou_threshold and best_tid not in used:
                d.track_id = best_tid
                self.tracks[best_tid]["bbox"] = d.bbox_xyxy
                self.tracks[best_tid]["age"] = 0
                used.add(best_tid)
            else:
                d.track_id = self.next_id
                self.tracks[self.next_id] = {"bbox": d.bbox_xyxy, "age": 0, "cls": d.cls}
                used.add(self.next_id)
                self.next_id += 1
        return detections

    def summarize(self) -> Dict[int, Dict]:
        return {tid: {"cls": tr["cls"]} for tid, tr in self.tracks.items()}



