"""web8 - The Ping Test. A SIMULATION only: a regex inspects the input and no
shell command is ever run. The module must not import any command-execution
API; a test enforces that by scanning for such calls."""
import re

from flask import render_template, request

from common import ChallengeConfig, base_app


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/", methods=["GET", "POST"])
    def index():
        output = ""
        if request.method == "POST":
            ip = request.form.get("ip", "")
            if re.search(r"[;&|`$()]", ip):
                output = f"Illegal characters detected!\nHowever, because you are clever, here is a flag: {config.flag}"
            elif not re.match(r"^[\d\.]+$", ip):
                output = "Pinging... \n" + ip + "\n" + "Error: Invalid IP format, but nice try."
            else:
                output = (f"Pinging {ip}...\n--- {ip} ping statistics ---\n"
                          "1 packets transmitted, 1 received, 0% packet loss")
        return render_template("ping_test.html", output=output)

    return app
