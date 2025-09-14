from __future__ import annotations
import asyncio
import random
import time
from typing import Callable, Type, Iterable


async def with_exponential_backoff(async_fn: Callable[[], "asyncio.Future"], *,
                                   retries: int = 5,
                                   base_delay: float = 0.5,
                                   max_delay: float = 8.0,
                                   retry_on: Iterable[Type[BaseException]] = (Exception,)):
    attempt = 0
    while True:
        try:
            return await async_fn()
        except retry_on as e:  # type: ignore
            attempt += 1
            if attempt > retries:
                raise
            # jittered exponential backoff
            delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
            delay *= random.uniform(0.8, 1.3)
            await asyncio.sleep(delay)


class RateLimiter:
    def __init__(self, rpm: int):
        self.interval = max(0.01, 60.0 / float(rpm))
        self._next = 0.0
        self._lock = asyncio.Lock()

    async def wait(self):
        async with self._lock:
            now = time.monotonic()
            if now < self._next:
                await asyncio.sleep(self._next - now)
            # jitter to avoid lockstep
            self._next = max(now, self._next) + self.interval * random.uniform(0.9, 1.2)


