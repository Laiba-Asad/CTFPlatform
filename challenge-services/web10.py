"""web10 - IDOR Profile Viewer. Admin profile (id 5) holds the flag."""
from flask import abort, render_template_string

from common import ChallengeConfig, base_app

PROFILE_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>User Profile</title></head>
<body><h1>{{ user.name }}'s Profile</h1><p>{{ user.bio }}</p></body></html>"""


def create_app(config: ChallengeConfig):
    app = base_app(config)
    users = {
        "1": {"name": "Alice", "bio": "Loves hiking and photography."},
        "2": {"name": "Bob", "bio": "Software developer based in SF."},
        "3": {"name": "Charlie", "bio": "Just another user."},
        "4": {"name": "Diana", "bio": "Musician and artist."},
        "5": {"name": "Admin", "bio": f"I hold the key! The flag is: {config.flag}"},
    }

    @app.route("/profile/<user_id>")
    def view_profile(user_id):
        user = users.get(user_id)
        if not user:
            abort(404, "User not found")
        return render_template_string(PROFILE_HTML, user=user)

    @app.route("/")
    def index():
        return "<h1>User Profiles</h1><p>Try accessing your profile at /profile/1</p>"

    return app
