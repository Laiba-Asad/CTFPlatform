"""web25 - Guest List. Ticket pages are numbered and nobody checks whose they are.

Intended trail: the player's own ticket is /ticket/1042 (the only one linked).
Tickets 1000-1050 exist; editing the number in the address bar to 1000 shows
the organizer's ticket, which holds the flag.
"""
import random

from flask import abort, redirect, render_template

from common import ChallengeConfig, base_app

FIRST, LAST, YOURS, ORGANIZER = 1000, 1050, 1042, 1000
FIRST_NAMES = ["Ana", "Ben", "Chen", "Dara", "Eli", "Fatima", "Gus", "Hana", "Ivan", "Jade", "Kofi", "Lina", "Max", "Nora"]
LAST_NAMES = ["Ahmed", "Brown", "Costa", "Diaz", "Evans", "Fischer", "Garcia", "Haddad", "Ito", "Khan", "Lopez", "Moreau"]


def build_tickets() -> dict:
    rng = random.Random(25)  # fixed demo data, same on every start
    tickets = {}
    for number in range(FIRST, LAST + 1):
        name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        tickets[number] = {"number": number, "holder": name, "seat": f"{rng.choice('ABCDEF')}{rng.randint(1, 30)}", "kind": "Guest"}
    tickets[YOURS] = {"number": YOURS, "holder": "You (demo ticket)", "seat": "C12", "kind": "Guest"}
    tickets[ORGANIZER] = {"number": ORGANIZER, "holder": "Event Organizer", "seat": "Backstage", "kind": "Organizer"}
    return tickets


def create_app(config: ChallengeConfig):
    app = base_app(config)
    tickets = build_tickets()

    @app.route("/")
    def home():
        return redirect(f"/ticket/{YOURS}", code=302)

    @app.route("/ticket/<int:number>")
    def ticket(number: int):
        t = tickets.get(number)
        if not t:
            abort(404)
        note = config.flag if number == ORGANIZER else None
        return render_template("web25_ticket.html", t=t, note=note)

    return app
