from __future__ import annotations
import os
import re
import json
from typing import Optional, Dict, List
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from ..utils import b64_of_bgr, prompts
import cv2
import logging
from datetime import datetime

_ANTH_MODEL = os.environ.get("ANTHROPIC_MODEL")

class VisionLLM:
    def __init__(self, cfg: Dict, max_tokens: int = 512):
        if not os.environ.get("ANTHROPIC_API_KEY"):
            here = Path(__file__).resolve().parents[1]
            load_dotenv(here / ".env")
            load_dotenv(here.parent / ".env")
        self.enabled = bool(cfg.get("enable_vlm", False))
        model = str(cfg.get("anthropic_model") or os.environ.get("ANTHROPIC_MODEL") or "").strip()
        key = os.environ.get("ANTHROPIC_API_KEY")
        if self.enabled and (not key or not model):
            raise RuntimeError("enable_vlm=true but ANTHROPIC_API_KEY or anthropic_model is missing")
        self.client = anthropic.Anthropic(api_key=key) if (self.enabled and key) else None
        self.model = model if self.enabled else None
        self.max_tokens = max_tokens
        self.images_per_call = int(cfg.get("vlm_images_per_call", 4))
        self.debug = bool(cfg.get("vlm_debug", False))
        self.artifacts_dir = Path(cfg.get("artifacts_dir", "."))
        self.debug_dir = self.artifacts_dir / "debug" / "vlm"
        if self.debug:
            self.debug_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger("models.vlm")

    def describe_batch(self, frames_bgr: List, context: Optional[Dict] = None) -> Optional[Dict]:
        if not self.client or not self.model or not frames_bgr:
            return None
        # limit images per call
        frames_bgr = frames_bgr[: self.images_per_call]
        content = []
        for img in frames_bgr:
            b64, media = b64_of_bgr(img)
            content.append({"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}})
        content.append({"type": "text", "text": prompts.VLM_BATCH_JSON})

        # optional debug: save previews and log metadata
        if self.debug:
            ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
            ctx_parts = []
            if context:
                for k in ("video", "chunk", "t_sec"):
                    if k in context:
                        ctx_parts.append(f"{k}-{context[k]}")
            prefix = "_".join(ctx_parts) if ctx_parts else "batch"
            save_dir = self.debug_dir / prefix
            save_dir.mkdir(parents=True, exist_ok=True)
            for i, img in enumerate(frames_bgr):
                cv2.imwrite(str(save_dir / f"{ts}_{i:02d}.jpg"), img)
            self.logger.info(f"vlm describe_batch model={self.model} images={len(frames_bgr)} ctx={context}")

        msg = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[{"role": "user", "content": content}],
        )
        text = "".join([c.text for c in msg.content if getattr(c, "type", None) == "text"]) or "{}"
        if self.debug:
            try:
                ts2 = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
                out_path = (self.debug_dir / (prefix if 'prefix' in locals() else 'batch')).with_suffix("")
                out_path.mkdir(parents=True, exist_ok=True)
                (out_path / f"{ts2}_raw.txt").write_text(text[:2000])
            except Exception:
                pass
        try:
            m = re.search(r"\{.*\}", text, re.S)
            return json.loads(m.group(0)) if m else {"raw": text}
        except Exception:
            return {"raw": text}



