"""Shared helpers for every challenge service.

Each service is a tiny Flask app returned by ``create_app(config)``. The
supervisor runs one OS process per challenge via ``serve.py``, passing only
that challenge's values through the environment. Nothing here reads the
platform database or shares state between challenges.

Rules enforced here:
- No flag or secret is ever written to a log (access logs omit query strings
  and bodies; we never log form values).
- Debugger and reloader are always off.
- A small request-size limit and a coarse per-service concurrency cap protect
  the host from a single noisy player or scanner.
"""
from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass, field
from functools import wraps
from typing import Callable

from flask import Flask, Response, g, request
from itsdangerous import BadSignature, URLSafeSerializer


@dataclass
class ChallengeConfig:
    challenge_id: str
    flag: str
    port: int
    # Per-challenge extras (web5 JWT secret, web9 OTP/phone, signing key, etc.)
    secrets: dict = field(default_factory=dict)
    # Absolute per-service runtime directory (sqlite files, decoy files...).
    runtime_dir: str = ""
    max_concurrency: int = 8
    max_content_length: int = 64 * 1024


def config_from_env() -> ChallengeConfig:
    cid = _require_env("CHALLENGE_ID")
    runtime_dir = os.environ.get("RUNTIME_DIR") or os.path.join(os.getcwd(), "runtime", cid)
    os.makedirs(runtime_dir, exist_ok=True)
    secrets = {}
    for key, value in os.environ.items():
        if key.startswith("CHALLENGE_SECRET_"):
            secrets[key[len("CHALLENGE_SECRET_"):].lower()] = value
    return ChallengeConfig(
        challenge_id=cid,
        flag=_require_env("CHALLENGE_FLAG"),
        port=int(_require_env("PORT")),
        secrets=secrets,
        runtime_dir=runtime_dir,
        max_concurrency=int(os.environ.get("MAX_CONCURRENCY", "8")),
    )


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def visitor_serializer(config: ChallengeConfig, salt: str) -> URLSafeSerializer:
    """Signs per-visitor cookies so a player cannot forge another's identity."""
    key = config.secrets.get("visitor_key") or config.secrets.get("jwt_secret") or config.flag
    return URLSafeSerializer(key, salt=salt)


def read_signed_cookie(serializer: URLSafeSerializer, raw: str | None):
    if not raw:
        return None
    try:
        return serializer.loads(raw)
    except BadSignature:
        return None


def base_app(config: ChallengeConfig) -> Flask:
    app = Flask(config.challenge_id, template_folder=os.path.join(os.path.dirname(__file__), "templates"))
    app.config.update(MAX_CONTENT_LENGTH=config.max_content_length, JSON_SORT_KEYS=False)
    _install_concurrency_cap(app, config.max_concurrency)
    _harden_headers(app)
    return app


def _install_concurrency_cap(app: Flask, limit: int) -> None:
    """Reject work past a coarse in-flight cap instead of exhausting the host."""
    semaphore = threading.BoundedSemaphore(limit)

    @app.before_request
    def _acquire():
        if not semaphore.acquire(blocking=False):
            return Response("Service busy, please slow down and retry.", status=503,
                            headers={"Retry-After": "2"})
        g._slot = True
        return None

    @app.teardown_request
    def _release(_exc):
        if g.pop("_slot", False):
            semaphore.release()


def _harden_headers(app: Flask) -> None:
    @app.after_request
    def _headers(resp: Response):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.pop("Server", None)
        return resp


def quiet_logging() -> None:
    """Access logs without query strings; never log form bodies or flags."""
    logging.getLogger("waitress").setLevel(logging.WARNING)
    logging.getLogger("waitress.queue").setLevel(logging.ERROR)


def flagless(func: Callable) -> Callable:
    """Marker decorator documenting a handler must not echo the flag unguarded."""
    @wraps(func)
    def wrapper(*a, **k):
        return func(*a, **k)
    return wrapper
