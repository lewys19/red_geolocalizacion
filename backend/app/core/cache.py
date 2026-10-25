"""Conexión a Redis compartida (caché, límites de peticiones, colas)."""

from functools import lru_cache

import redis

from app.core.config import settings


@lru_cache
def cliente_redis() -> redis.Redis:
    return redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2, decode_responses=True)
