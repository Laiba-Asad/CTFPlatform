"""web7 - The Reading Room. Serves a page by name from its own files folder.

The flag sits in config.ini.bak, regenerated into runtime_dir at start from the
service's env (never copied from the old repo). os.path.basename keeps the read
inside the files folder, which is the intended behaviour: the solution is to ask
for the backup file by name, not to traverse out of the directory.
"""
import os

from flask import request

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)
    files_dir = os.path.join(config.runtime_dir, "files")
    os.makedirs(files_dir, exist_ok=True)
    with open(os.path.join(files_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write('<h1>Homepage</h1><p>Check out our <a href="?page=news.txt">news</a>!</p>')
    with open(os.path.join(files_dir, "news.txt"), "w", encoding="utf-8") as f:
        f.write("No news today.")
    with open(os.path.join(files_dir, "config.ini.bak"), "w", encoding="utf-8") as f:
        f.write(f"[secrets]\nflag = {config.flag}\n")

    @app.route("/")
    def index():
        page = request.args.get("page", "index.html")
        try:
            with open(os.path.join(files_dir, os.path.basename(page)), "r", encoding="utf-8") as f:
                return f.read()
        except (IOError, FileNotFoundError):
            return "File not found.", 404

    return app
