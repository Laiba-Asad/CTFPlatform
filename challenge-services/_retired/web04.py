"""web4 - Local Traffic Only. Trusts X-Forwarded-For: 127.0.0.1.

This service must be reached DIRECTLY (never through the platform reverse
proxy, which would append to X-Forwarded-For and break the challenge).
"""
from flask import request

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def index():
        if request.headers.get("X-Forwarded-For") == "127.0.0.1":
            return f"<h1>Welcome, Local Admin!</h1><p>Here is your flag: {config.flag}</p>"
        return "<h1>Access Denied</h1><p>Only local admins can see this page.</p>"

    return app
