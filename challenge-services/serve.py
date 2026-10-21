"""Entry point run by the supervisor: one process per challenge service.

Reads CHALLENGE_ID, CHALLENGE_FLAG, PORT and CHALLENGE_SECRET_* from the
environment, builds the matching Flask app and serves it with waitress
(threaded, no debugger, no reloader). Flags never appear in logs.

Usage (normally invoked by the Node supervisor):
    python serve.py
"""
import importlib
import sys

from waitress import serve

from common import config_from_env, quiet_logging

# Active challenge services (challenge id -> module). Retired challenges live in
# _retired/ and are deliberately absent, so they can never be started.
MODULES = {
    "web1": "web01",
    "web2": "web02",
    "web14": "web14",
    "web15": "web15",
    "web16": "web16",
    "web17": "web17",
    "web18": "web18",
    "web19": "web19",
    "web20": "web20",
    "web21": "web21",
    "web22": "web22",
    "web23": "web23",
    "web24": "web24",
    "web25": "web25",
    "net5": "net5",
}


def main() -> int:
    config = config_from_env()
    module_name = MODULES.get(config.challenge_id)
    if not module_name:
        print(f"Unknown challenge id: {config.challenge_id}", file=sys.stderr)
        return 2
    module = importlib.import_module(module_name)
    app = module.create_app(config)
    quiet_logging()
    # threads a little above the concurrency cap so queued work drains quickly.
    serve(app, host="0.0.0.0", port=config.port, threads=max(4, config.max_concurrency + 2),
          ident="ctf", _quiet=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
