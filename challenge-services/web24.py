"""web24 - Badge Check. The server trusts a plain `badge_level` cookie.

Intended trail: DevTools Application > Cookies, change badge_level from
visitor to staff, reload. Only then does the page show the flag.

Cookies are shared by every port on the same host, so this service only ever
reads or sets its own uniquely named cookie and never touches platform cookies.
"""
from flask import make_response, render_template, request

from common import ChallengeConfig, base_app

COOKIE = "badge_level"


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def door():
        level = request.cookies.get(COOKIE)
        staff = level == "staff"
        resp = make_response(render_template("web24_door.html", staff=staff, flag=config.flag if staff else None))
        if level is None:
            resp.set_cookie(COOKIE, "visitor", samesite="Lax")
        return resp

    return app
