from __future__ import annotations
import os
from typing import Optional
from cerebras.cloud.sdk import Cerebras


def synthesize_text(prompt: str, max_tokens: int = 512, temperature: float = 0.2) -> str:
    key = os.environ.get("CEREBRAS_API_KEY")
    if not key:
        return ""
    model = os.environ.get("CEREBRAS_MODEL", "gpt-oss-120b")

    client = Cerebras(api_key=key)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_completion_tokens=max_tokens,
        temperature=temperature,
    )
    try:
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""



