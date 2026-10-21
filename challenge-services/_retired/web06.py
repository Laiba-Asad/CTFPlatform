"""web6 - Forgotten Files. A .bak of a linked script holds the flag."""
from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def index():
        return '<a href="/main.js">Check out our main script!</a>'

    @app.route("/main.js")
    def main_js():
        return "console.log('Main application logic.');", 200, {"Content-Type": "application/javascript"}

    @app.route("/main.js.bak")
    def backup_js():
        return f"// This is a backup. Flag is {config.flag}", 200, {"Content-Type": "text/plain"}

    return app
