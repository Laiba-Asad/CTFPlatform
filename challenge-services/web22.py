"""web22 - Console Whisper. The page whispers a function name in the console.

Intended trail: open the DevTools Console; the page logs a hint naming
`whisper()`. Calling it fetches /api/whisper and prints the flag. The flag is
never in the HTML or the script, only in that response and the function result.
"""
from flask import Response, jsonify, render_template

from common import ChallengeConfig, base_app

SCRIPT = """// Console Whisper
console.log('%cPsst... you found the console.', 'font-weight: bold');
console.log('If you want to hear a secret, type whisper() and press Enter.');

function whisper() {
  return fetch('/api/whisper')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      console.log(data.secret);
      return data.secret;
    });
}
"""


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def page():
        return render_template("web22_whisper.html")

    @app.route("/assets/whisper.js")
    def script():
        return Response(SCRIPT, mimetype="application/javascript", headers={"Cache-Control": "no-store"})

    @app.route("/api/whisper")
    def secret():
        resp = jsonify(secret=f"The secret is {config.flag}")
        resp.headers["Cache-Control"] = "no-store"
        return resp

    return app
