from __future__ import annotations
import os
from typing import Dict
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from cerebras.cloud.sdk import Cerebras
from ..utils.backoff import with_exponential_backoff, RateLimiter


limiter = RateLimiter(rpm=28)

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

    async def _call():
        await limiter.wait()
        return client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_completion_tokens=max_tokens,
            temperature=temperature,
        )

    try:
        try:
            loop = asyncio.get_running_loop()
            resp = loop.run_until_complete(with_exponential_backoff(_call, retries=6))  # type: ignore
        except RuntimeError:
            resp = asyncio.run(with_exponential_backoff(_call, retries=6))
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""



