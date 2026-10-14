"""web11 - Cookie Stealer (stored XSS).

Fix: feedback was one global list and /view_feedback showed only the last
message, so players overwrote each other and ran scripts in everyone's browser.
Now each visitor is keyed by a signed cookie (ctf_w11_visitor) and sees only
their own submissions, so the stored-XSS vulnerability works exactly as intended
but is isolated per player. The admin_session cookie behaviour is unchanged.
"""
import base64
import uuid

from flask import make_response, render_template_string, request

from common import ChallengeConfig, base_app, read_signed_cookie, visitor_serializer

FORM_HTML = """<h1>Submit Feedback</h1>
<form method="post"><textarea name="message"></textarea><button>Submit</button></form>
<br><a href="/view_feedback">View Submissions</a>"""

PANEL_HTML = """<h1>Admin Feedback Panel</h1><h3>Latest Feedback:</h3><div>{{ msg | safe }}</div>"""


def create_app(config: ChallengeConfig):
    app = base_app(config)
    encoded_flag = base64.b64encode(config.flag.encode()).decode()
    serializer = visitor_serializer(config, salt="w11-visitor")
    # Per-visitor message store, isolated so one player's script never runs in another's browser.
    messages: dict[str, list[str]] = {}

    def visitor_id() -> str:
        return read_signed_cookie(serializer, request.cookies.get("ctf_w11_visitor")) or ""

    def attach_visitor(resp, vid: str):
        resp.set_cookie("ctf_w11_visitor", serializer.dumps(vid), httponly=True, samesite="Lax")
        return resp

    @app.route("/", methods=["GET", "POST"])
    def feedback_form():
        vid = visitor_id() or uuid.uuid4().hex
        if request.method == "POST":
            messages.setdefault(vid, ["Welcome! Please leave your feedback below."])
            messages[vid].append(request.form.get("message", ""))
            resp = make_response('<h1>Thank you! Admin will review it.</h1>'
                                 '<a href="/view_feedback">View Submissions</a>')
            return attach_visitor(resp, vid)
        return attach_visitor(make_response(FORM_HTML), vid)

    @app.route("/view_feedback")
    def view_feedback():
        vid = visitor_id() or uuid.uuid4().hex
        latest = messages.get(vid, ["Welcome! Please leave your feedback below."])[-1]
        resp = make_response(render_template_string(PANEL_HTML, msg=latest))
        # The "admin" reviewing feedback carries this prize cookie.
        resp.set_cookie("admin_session", encoded_flag)
        return attach_visitor(resp, vid)

    return app
