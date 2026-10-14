"""web3 - The VIP Lounge. Classic SQL-injection login bypass.

Fixes vs the old code:
- The intentionally vulnerable query is unchanged (that IS the challenge), but
  sqlite3.Error is caught and shown as the same "Invalid Credentials." message
  so a malformed injection no longer returns a raw 500.
- The per-service SQLite DB lives at an absolute path inside runtime_dir, so the
  challenge can never touch the platform database.
- /dashboard is gated behind a signed "logged_in" cookie set only on a
  successful login, so the flag is not reachable by visiting /dashboard directly.
- No debug, no reloader.
"""
import os
import sqlite3

from flask import make_response, redirect, render_template, request, url_for

from common import ChallengeConfig, base_app, read_signed_cookie, visitor_serializer


def create_app(config: ChallengeConfig):
    app = base_app(config)
    db_path = os.path.join(config.runtime_dir, "challenge3.db")
    serializer = visitor_serializer(config, salt="w3-login")

    if not os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)")
        conn.execute("INSERT INTO users (username, password) VALUES ('admin', 'supersecretpassword123')")
        conn.commit()
        conn.close()

    @app.route("/", methods=["GET", "POST"])
    def login():
        error = None
        if request.method == "POST":
            username = request.form.get("username", "")
            password = request.form.get("password", "")
            # Intentionally vulnerable (the challenge); errors handled gracefully.
            query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
            conn = sqlite3.connect(db_path)
            try:
                user = conn.cursor().execute(query).fetchone()
            except sqlite3.Error:
                user = None
            finally:
                conn.close()
            if user:
                resp = make_response(redirect(url_for("dashboard")))
                resp.set_cookie("w3_auth", serializer.dumps("ok"), httponly=True)
                return resp
            error = "Invalid Credentials."
        return render_template("login.html", error=error)

    @app.route("/dashboard")
    def dashboard():
        if read_signed_cookie(serializer, request.cookies.get("w3_auth")) != "ok":
            return redirect(url_for("login"))
        return render_template("dashboard.html", flag=config.flag)

    return app
