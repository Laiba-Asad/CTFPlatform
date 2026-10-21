"""web9 - OTP Bypass. Verify requires a hidden phone_number parameter.

Fix: the registered number was never shown anywhere, so the challenge was
unsolvable. The verify page now carries the registered number inside an HTML
comment (the "hidden parameter the user must find and add"). The OTP, the
hidden-parameter mechanism and the flag logic are unchanged.
"""
from flask import redirect, render_template_string, request, url_for

from common import ChallengeConfig, base_app

REGISTER_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Register</title></head>
<body><h1>Register</h1><form method="post">
Username: <input name="username"><br>Password: <input type="password" name="password"><br>
Phone: <input name="phone"><br><button>Register</button></form></body></html>"""

# The registered number lives in this comment: that is the "hidden parameter".
VERIFY_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Verify OTP</title></head>
<body><h1>Verify OTP</h1>
<p>An OTP has been sent to your registered number.</p>
<!-- Account on file: phone_number={{ real_phone }} (registered owner only) -->
<form method="post"><input type="text" name="otp" placeholder="OTP">
<button type="submit">Verify</button></form>
{% if message %}<p>{{ message }}</p>{% endif %}</body></html>"""


def create_app(config: ChallengeConfig):
    app = base_app(config)
    otp_code = config.secrets.get("otp", "")
    real_phone = config.secrets.get("phone", "")

    @app.route("/", methods=["GET", "POST"])
    def register():
        if request.method == "POST":
            return redirect(url_for("verify"))
        return render_template_string(REGISTER_HTML)

    @app.route("/verify", methods=["GET", "POST"])
    def verify():
        message = ""
        if request.method == "POST":
            otp = request.form.get("otp")
            phone_number = request.form.get("phone_number")
            if phone_number == real_phone and otp == otp_code:
                message = f"Correct! Here is your flag: {config.flag}"
            elif not phone_number:
                message = "Verification failed. Parameter missing."
            else:
                message = "Invalid OTP or phone number."
        return render_template_string(VERIFY_HTML, message=message, real_phone=real_phone)

    return app
