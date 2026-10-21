"""web19 - Invisible Ink. The flag is on the page, but hidden with CSS.

Intended trail: Select All (Ctrl+A) or Inspect Element. The text is rendered in
the background colour and the same note is also parked off screen.
"""
from flask import render_template

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def page():
        return render_template("web19_ink.html", flag=config.flag)

    return app
