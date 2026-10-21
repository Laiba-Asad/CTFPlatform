"""web15 - Decode Me. A script the page loads holds the flag as a Base64 string.

Intended trail: DevTools (Sources / Network) shows /assets/app.js; the string in
it decodes (via the in-site Toolkit, or atob() in the console) to the flag. The page
itself never contains the flag, plain or encoded.
"""
import base64

from flask import Response, render_template

from common import ChallengeConfig, base_app

SCRIPT = """// Lighthouse Books - site script
(function () {
  var motd = "%s";
  var banner = document.getElementById('banner');
  if (banner) banner.textContent = 'Today: 10%% off all mystery novels!';
  // TODO: show the message of the day once the translation is done
  void motd;
})();
"""


def create_app(config: ChallengeConfig):
    app = base_app(config)
    encoded = base64.b64encode(config.flag.encode()).decode()
    script = SCRIPT % encoded

    @app.route("/")
    def home():
        return render_template("web15_home.html")

    @app.route("/assets/app.js")
    def app_js():
        return Response(script, mimetype="application/javascript",
                        headers={"Cache-Control": "no-store"})

    return app
