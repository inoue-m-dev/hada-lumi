from __future__ import annotations

import os
from typing import Optional

import redis.asyncio as redis

_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global _redis_client
    if _redis_client is None:
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            return None
        _redis_client = redis.from_url(redis_url, decode_responses=True)
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
