from __future__ import annotations
import os
import re
import json
from typing import Optional, Dict, List
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from ..utils import b64_of_bgr, prompts

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

    def describe_batch(self, frames_bgr: List) -> Optional[Dict]:
        if not self.client or not self.model or not frames_bgr:
            return None
        # limit images per call
        frames_bgr = frames_bgr[: self.images_per_call]
        content = []
        for img in frames_bgr:
            b64, media = b64_of_bgr(img)
            content.append({"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}})
        content.append({"type": "text", "text": prompts.VLM_BATCH_JSON})

        msg = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[{"role": "user", "content": content}],
        )
        text = "".join([c.text for c in msg.content if getattr(c, "type", None) == "text"]) or "{}"
        try:
            m = re.search(r"\{.*\}", text, re.S)
            return json.loads(m.group(0)) if m else {"raw": text}
        except Exception:
            return {"raw": text}



