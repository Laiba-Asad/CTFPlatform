"""web21 - Storage Locker. The page stores a note (holding the flag) in localStorage.

Intended trail: DevTools Application > Local Storage > key `note_to_self`.
On load the page script fetches /api/note and saves it there. The HTML and the
script never contain the flag; only the /api/note response and the stored
value do.
"""
from flask import Response, jsonify, render_template

from common import ChallengeConfig, base_app

SCRIPT = """// Storage Locker - remembers your note for next time.
(function () {
  fetch('/api/note')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      localStorage.setItem('note_to_self', data.note);
      document.getElementById('status').textContent = 'Your note has been saved for later.';
    })
    .catch(function () {
      document.getElementById('status').textContent = 'Could not load your note.';
    });
})();
"""


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def page():
        return render_template("web21_locker.html")

    @app.route("/assets/locker.js")
    def script():
        return Response(SCRIPT, mimetype="application/javascript", headers={"Cache-Control": "no-store"})

    @app.route("/api/note")
    def note():
        resp = jsonify(note=f"Remember the locker code: {config.flag}")
        resp.headers["Cache-Control"] = "no-store"
        return resp

    return app
