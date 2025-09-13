from __future__ import annotations
from typing import List
import numpy as np
from ultralytics import YOLO
from ..schemas import Detection


class YoloDetector:
    def __init__(self, weights: str, target_classes: List[str], conf_thres: float = 0.25):
        self.model = YOLO(weights)
        self.names = self.model.names
        self.want = set(target_classes)
        self.conf_thres = conf_thres

    def infer(self, frame_bgr: np.ndarray) -> List[Detection]:
        res = self.model.predict(source=frame_bgr, verbose=False, conf=self.conf_thres)[0]
        out: List[Detection] = []
        if res.boxes is None:
            return out
        for b in res.boxes:
            cls_idx = int(b.cls.item())
            cls_name = self.names.get(cls_idx, str(cls_idx))
            if cls_name not in self.want:
                continue
            out.append(
                Detection(
                    cls=cls_name,
                    conf=float(b.conf.item()),
                    bbox_xyxy=[float(x) for x in b.xyxy.cpu().numpy().reshape(-1).tolist()],
                )
            )
        return out
