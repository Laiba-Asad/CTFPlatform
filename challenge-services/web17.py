"""web17 - Price Tag. The checkout trusts a hidden price field from the browser.

Intended trail (browser only): the shop form has a hidden `price` input. In
DevTools Elements, change its value to 1 (or less) and submit. The confirmation
for such an order contains the flag; the shop page and normal orders never do.
"""
import math

from flask import render_template, request

from common import ChallengeConfig, base_app

ITEM = {"id": "golden-keyboard", "name": "Golden Keyboard (limited edition)", "price": "4999.00"}


def create_app(config: ChallengeConfig):
    app = base_app(config)

    @app.route("/")
    def shop():
        return render_template("web17_shop.html", item=ITEM)

    @app.route("/checkout", methods=["POST"])
    def checkout():
        if request.form.get("item") != ITEM["id"]:
            return render_template("web17_result.html", error="That item is not in our shop."), 400
        try:
            price = float(request.form.get("price", ""))
        except ValueError:
            price = math.nan
        if not math.isfinite(price):
            return render_template("web17_result.html", error="Invalid price."), 400
        if price <= 1:
            return render_template("web17_result.html", item=ITEM, paid=f"{price:.2f}", flag=config.flag)
        return render_template("web17_result.html", item=ITEM, paid=f"{price:.2f}", declined=True)

    return app
