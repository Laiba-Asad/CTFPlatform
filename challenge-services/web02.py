"""web2 - Restricted Area. robots.txt points at a disallowed path (/flag.txt)."""
from flask import Response

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def index():
        return ("<!doctype html><html><head><meta charset='utf-8'><title>Welcome</title></head>"
                "<body><h1>Welcome!</h1><p>Our brand new, ultra-secure corporate website.</p></body></html>")

    @app.route("/robots.txt")
    def robots():
        return Response("User-agent: *\nDisallow: /flag.txt\n", mimetype="text/plain")

    @app.route("/flag.txt")
    def flag():
        return Response(f"Congratulations: {config.flag}", mimetype="text/plain")

    return app
