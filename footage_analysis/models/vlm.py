from __future__ import annotations
import os
import re
import json
from typing import Optional, Dict
from anthropic import Anthropic
from ..utils import b64_of_bgr


_ANTH_MODEL = os.environ.get("ANTHROPIC_MODEL")


class VisionLLM:
    def __init__(self, max_tokens: int = 512):
        self.client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = _ANTH_MODEL
        self.max_tokens = max_tokens

    def describe(self, frame_bgr, instruction: str) -> Optional[Dict]:
        b64, media = b64_of_bgr(frame_bgr)
        msg = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                        {"type": "text", "text": instruction},
                    ],
                }
            ],
        )
        text = "".join([c.text for c in msg.content if getattr(c, "type", None) == "text"])
        try:
            m = re.search(r"\{.*\}", text, re.S)
            return json.loads(m.group(0)) if m else {"raw": text}
        except Exception:
            return {"raw": text}



