"""web14 - Open the Hood. A developer note in an HTML comment carries the flag.

Intended trail: View Source / DevTools Elements on the welcome page. The flag is
only inside the HTML comment; it is never rendered as visible text, sent in a
header or set as a cookie.
"""
from flask import render_template

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def welcome():
        return render_template("web14_welcome.html", flag=config.flag)

    return app
