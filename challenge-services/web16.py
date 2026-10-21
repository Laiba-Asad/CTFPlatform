"""web16 - Header Hunt. The flag rides in a custom header of a redirect.

Flow: / --302--> /api/status --302--> /status (the page the browser ends on).
Only the /api/status redirect carries the flag, in the X-Status-Token response
header. It is never in any body or in the final page, so the browser hides it
unless the player watches the hop in DevTools Network with "Preserve log" on.
"""
from flask import Response, redirect, render_template

from common import ChallengeConfig, base_app

FLAG_HEADER = "X-Status-Token"


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def entry():
        return redirect("/api/status", code=302)

    @app.route("/api/status")
    def api_status():
        resp: Response = redirect("/status", code=302)
        resp.headers[FLAG_HEADER] = config.flag
        resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.route("/status")
    def status_page():
        return render_template("web16_status.html")

    return app
