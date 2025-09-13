from __future__ import annotations
import base64
import cv2


def b64_of_bgr(img):
    ok, buf = cv2.imencode(".jpg", img)
    if not ok:
        raise RuntimeError("encode fail")
    return base64.b64encode(buf.tobytes()).decode("ascii"), "image/jpeg"



