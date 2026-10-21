"""web23 - Gatekeeper. The staff door checks its password in the browser.

Intended trail: read the (unminified) page script in DevTools Sources; it builds
the password by joining pieces. Typing that password makes the page POST it to
/api/open, and only then does the server return the flag. The password comes
from the supervisor (WEB23_PASSWORD in .flags.env); the flag is never in any script.
"""
import json

from flask import Response, jsonify, render_template, request

from common import ChallengeConfig, base_app

SCRIPT = """// Staff door - checks the password before bothering the server.
(function () {
  var pieces = %s;
  var staffPassword = pieces.join('');

  document.getElementById('door').addEventListener('submit', function (event) {
    event.preventDefault();
    var typed = document.getElementById('password').value;
    var out = document.getElementById('result');
    if (typed !== staffPassword) {
      out.textContent = 'Wrong password. The door stays shut.';
      return;
    }
    fetch('/api/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: typed })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { out.textContent = data.message; });
  });
})();
"""


def split_pieces(secret: str, parts: int = 3) -> list:
    size = max(1, -(-len(secret) // parts))
    return [secret[i:i + size] for i in range(0, len(secret), size)]


def create_app(config: ChallengeConfig):
    app = base_app(config)
    password = config.secrets.get("password", "")
    script = SCRIPT % json.dumps(split_pieces(password))

    @app.route("/")
    def page():
        return render_template("web23_door.html")

    @app.route("/assets/gate.js")
    def gate_js():
        return Response(script, mimetype="application/javascript", headers={"Cache-Control": "no-store"})

    @app.route("/api/open", methods=["POST"])
    def open_door():
        body = request.get_json(silent=True) or {}
        if not password or body.get("password") != password:
            return jsonify(message="The door stays shut."), 403
        return jsonify(message=f"Door open. Staff code: {config.flag}")

    return app
