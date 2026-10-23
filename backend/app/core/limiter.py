"""Rate-limiting helpers built on slowapi.

Interface
---------
This module exposes a small façade so the storage backend can be swapped from
in-memory to Redis without touching any route code.

Currently the limiter uses an in-memory store (``slowapi``'s default).
**In-memory limits only work correctly for a single worker process.**  If you
scale to multiple workers (e.g. ``uvicorn --workers 4``), replace ``Limiter``
with a Redis-backed instance::

    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri="redis://redis:6379",  # set REDIS_URL in config first
    )

Then mount and wire it up the same way as below.

Usage in routes
---------------
    from app.core.limiter import limiter
    from app.core.limiter import rate_limit_by_ip, rate_limit_by_user

    @router.post("/login")
    @limiter.limit("5/minute", key_func=rate_limit_by_ip)
    def login(request: Request, ...):
        ...
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


# ── Storage ──────────────────────────────────────────────────────────────────
# In-memory; swap storage_uri for Redis when scaling horizontally.
limiter = Limiter(key_func=get_remote_address)


# ── Key functions ─────────────────────────────────────────────────────────────

def rate_limit_by_ip(request: Request) -> str:
    """Key on the client IP address (for public endpoints like login/register)."""
    return get_remote_address(request)


def rate_limit_by_user(request: Request) -> str:
    """Key on the authenticated user id (falls back to IP for anonymous requests)."""
    # The JWT payload is decoded in get_current_user; we read it directly from
    # the Authorization header here so we don't need to inject the full dep.
    from jose import JWTError
    from app.core.security import decode_token

    auth: str = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:]
        try:
            payload = decode_token(token)
            return f"user:{payload['sub']}"
        except (JWTError, KeyError):
            pass
    return get_remote_address(request)
