"""web5 - The Golden Ticket. JWT privilege escalation (guest -> admin)."""
from datetime import datetime, timezone

import jwt
from flask import make_response, request

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)
    secret = config.secrets.get("jwt_secret", "")

    @app.route("/")
    def index():
        token = request.cookies.get("session")
        if token:
            try:
                decoded = jwt.decode(token, secret, algorithms=["HS256"])
            except jwt.InvalidTokenError:
                return "<h1>Invalid Token!</h1>"
            if decoded.get("user") == "admin":
                return f"<h1>Welcome Admin!</h1><p>Your flag is: {config.flag}</p>"
            return f"<h1>Welcome {decoded.get('user')}!</h1><p>You are not an admin.</p>"

        user_token = jwt.encode({"user": "guest", "iat": datetime.now(timezone.utc)}, secret, algorithm="HS256")
        resp = make_response("<h1>Welcome Guest!</h1><p>Only admins can see the flag. "
                             "Here is your session token.</p>")
        resp.set_cookie("session", user_token)
        return resp

    return app
