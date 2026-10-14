"""web12 - Leaky Downloads. Download endpoint serves any file in its folder.

The decoy files and the flag file are regenerated into runtime_dir at start from
the service env (never copied from the old repo). Absolute paths only.
"""
import os

from flask import request, send_from_directory

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)
    download_dir = os.path.join(config.runtime_dir, "notes")
    os.makedirs(download_dir, exist_ok=True)
    files = {
        "user_note.txt": "This is your personal note.",
        "todo.txt": "1. Buy milk. 2. Fix bugs.",
        "system.log": "INFO: System startup successful.",
        "flag.txt": config.flag,
    }
    for name, body in files.items():
        with open(os.path.join(download_dir, name), "w", encoding="utf-8") as f:
            f.write(body)

    @app.route("/")
    def index():
        return '<a href="/download?file=user_note.txt">Download your note</a>'

    @app.route("/download")
    def download_file():
        filename = request.args.get("file")
        if not filename:
            return "File not specified."
        try:
            return send_from_directory(download_dir, filename, as_attachment=True)
        except (FileNotFoundError, NotADirectoryError):
            return "File not found.", 404

    return app
