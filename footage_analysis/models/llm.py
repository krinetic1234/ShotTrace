from __future__ import annotations
import os
from typing import Dict
from pathlib import Path
from dotenv import load_dotenv
from cerebras.cloud.sdk import Cerebras


def synthesize_text(prompt: str, cfg: Dict) -> str:
    # read llm settings from config
    if not bool(cfg.get("enable_llm", True)):
        return ""

    # ensure env is loaded (repo root or module dir)
    if not os.environ.get("CEREBRAS_API_KEY"):
        here = Path(__file__).resolve().parents[1]
        load_dotenv(here / ".env")
        load_dotenv(here.parent / ".env")

    key = os.environ.get("CEREBRAS_API_KEY")
    if not key:
        return ""

    model = str(cfg.get("model") or os.environ.get("CEREBRAS_MODEL") or "gpt-oss-120b")
    max_tokens = int(cfg.get("max_tokens", 512))
    temperature = float(cfg.get("temperature", 0.2))

    client = Cerebras(api_key=key)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_completion_tokens=max_tokens,
            temperature=temperature,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""



