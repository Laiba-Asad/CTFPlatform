"""web1 - The Snack Cabinet. Flag handed to the browser in a cookie (base64)."""
import base64

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)
    encoded = base64.b64encode(config.flag.encode()).decode()

    @app.route("/")
    def challenge():
        from flask import make_response
        resp = make_response(
            "<!doctype html><html><head><meta charset='utf-8'><title>Snack Cabinet</title></head>"
            "<body style='font-family:monospace;text-align:center;padding-top:80px'>"
            "<h1>OM NOM NOM</h1><p>I love cookies! This one tastes... weird.</p></body></html>"
        )
        # Intended trail: the flag rides along, base64-encoded, in this cookie.
        resp.set_cookie("secret_recipe", encoded)
        return resp

    return app
