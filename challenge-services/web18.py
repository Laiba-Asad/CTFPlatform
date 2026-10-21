"""web18 - Layers. The flag is shown only as noise: two layers of encoding.

Encoding (inside out): ROT13, then Base64. Intended trail: the in-site Toolkit
(Base64 decode -> ROT13). The plain flag and the ROT13 intermediate never
appear in any response; only the final Base64 text does.
"""
import base64
import codecs

from flask import render_template

from common import ChallengeConfig, base_app


def encode_layers(flag: str) -> str:
    rot13 = codecs.encode(flag, "rot_13")
    return base64.b64encode(rot13.encode()).decode()


def create_app(config: ChallengeConfig):
    app = base_app(config)
    noise = encode_layers(config.flag)

    @app.route("/")
    def page():
        return render_template("web18_noise.html", noise=noise)

    return app
