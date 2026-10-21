"""web13 - Reflected XSS.

Fix: the flag used to be rendered into the inline script on every page load, so
"view source" revealed it without solving anything. Now the flag (and the
success markup) is only included when the submitted q contains a reflected
alert('XSS') payload. The reflection itself stays unsanitised (that is the
vulnerability); the server-side gate just decides whether to reward it.

Gate (QUALIFYING_PAYLOAD): q must contain, case-insensitively, an alert call
whose argument is the exact string XSS in single/double/back quotes, e.g.
alert('XSS'). This matches the payload the challenge asks players to land.
"""
import re

from flask import render_template_string, request

from common import ChallengeConfig, base_app

QUALIFYING_PAYLOAD = re.compile(r"alert\s*\(\s*(['\"`])XSS\1\s*\)", re.IGNORECASE)

# window.alert override lives in <head> so a reflected alert('XSS') actually
# fires in a real browser; the server still gates whether the flag is present.
PAGE_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Search</title>
<script>
window.alert = function (msg) {
  if (msg === 'XSS') {
    var h = document.createElement('h1');
    h.textContent = {{ success_text | tojson }};
    document.body.appendChild(h);
  }
};
</script></head>
<body>
<h1>Search</h1>
<form method="get"><input name="q"><button>Search</button></form><hr>
<h2>Results for: {{ query | safe }}</h2>
{% if success_html %}{{ success_html | safe }}{% endif %}
</body></html>"""


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def search():
        query = request.args.get("q", "")
        qualifies = bool(QUALIFYING_PAYLOAD.search(query))
        success_html = f"<h1>Success! Flag: {config.flag}</h1>" if qualifies else ""
        success_text = f"Success! Flag: {config.flag}" if qualifies else ""
        return render_template_string(PAGE_HTML, query=query,
                                      success_html=success_html, success_text=success_text)

    return app
