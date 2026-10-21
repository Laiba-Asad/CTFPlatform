"""net4 - Open Door. An unlisted HTTP service on the event server.

Intended trail: scan ports 5000-5100 of the event server (nmap), find the one
nobody listed, open it in a browser. The page shows the flag. The platform never
links to this port (the player API does not send it), so the scan is the trail.
"""
from flask import render_template

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def door():
        return render_template("net4_door.html", flag=config.flag)

    return app
