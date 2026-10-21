"""web20 - Locked Button. The Claim button is disabled in the HTML.

Intended trail: DevTools Elements, remove the `disabled` attribute, click Claim.
The click submits a POST to /claim, whose response holds the flag. The page
itself never contains the flag.
"""
from flask import render_template

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def page():
        return render_template("web20_claim.html")

    @app.route("/claim", methods=["POST"])
    def claim():
        return render_template("web20_claimed.html", flag=config.flag)

    return app
