"""RETIRED tests for web3, web6, web7, web8, web11, web12 (removed from the board
before the 22 October 2026 event). Not collected by pytest (the file name does
not start with test_). To restore a challenge: move its module back next to
serve.py, add it to serve.MODULES and the seed, and move its tests back into
test_challenges.py (they expect `app_for` from there).
"""
import base64
import os
import re

import pytest

from test_challenges import app_for  # noqa: F401  (only importable when restored)

COMMAND_EXEC = re.compile(r"\bimport\s+(subprocess|os\s*,|pty)\b|\bsubprocess\.\w|\bos\.(system|popen|exec\w*|spawn\w*)\s*\(|\bpty\.")


def test_web3_sqli_then_dashboard(tmp):
    app, cfg = app_for("web3", tmp)
    c = app.test_client()
    r = c.post("/", data={"username": "admin' -- ", "password": "x"})
    assert r.status_code in (301, 302)
    assert cfg.flag in c.get("/dashboard").get_data(as_text=True)


def test_web6_backup(tmp):
    app, cfg = app_for("web6", tmp)
    assert cfg.flag in app.test_client().get("/main.js.bak").get_data(as_text=True)


def test_web7_lfi_backup(tmp):
    app, cfg = app_for("web7", tmp)
    assert cfg.flag in app.test_client().get("/?page=config.ini.bak").get_data(as_text=True)


def test_web8_injection_chars(tmp):
    app, cfg = app_for("web8", tmp)
    assert cfg.flag in app.test_client().post("/", data={"ip": "127.0.0.1; ls"}).get_data(as_text=True)


def test_web11_stored_xss_own_message(tmp):
    app, cfg = app_for("web11", tmp)
    c = app.test_client()
    c.post("/", data={"message": "<script>steal()</script>"})
    assert "<script>steal()</script>" in c.get("/view_feedback").get_data(as_text=True)
    r = c.get("/view_feedback")
    cookie = next(v for k, v in r.headers if k == "Set-Cookie" and v.startswith("admin_session="))
    assert base64.b64decode(cookie.split(";")[0].split("=", 1)[1]).decode() == cfg.flag


def test_web12_traversal_to_flag(tmp):
    app, cfg = app_for("web12", tmp)
    assert cfg.flag in app.test_client().get("/download?file=flag.txt").get_data(as_text=True)


@pytest.mark.parametrize("cid,paths", [
    ("web3", ["/", "/dashboard"]),
    ("web6", ["/", "/main.js"]),
    ("web7", ["/", "/?page=news.txt"]),
    ("web8", ["/"]),
    ("web12", ["/", "/download?file=user_note.txt"]),
])
def test_no_leak(cid, paths, tmp):
    app, cfg = app_for(cid, tmp)
    c = app.test_client()
    for path in paths:
        r = c.get(path)
        blob = r.get_data(as_text=True) + "".join(f"{k}:{v}" for k, v in r.headers)
        assert cfg.flag not in blob, f"{cid} leaked the flag at {path}"


def test_web11_visitor_isolation(tmp):
    app, _ = app_for("web11", tmp)
    a, b = app.test_client(), app.test_client()
    a.post("/", data={"message": "AAA-secret-from-a"})
    b.get("/")
    assert "AAA-secret-from-a" not in b.get("/view_feedback").get_data(as_text=True)


def test_web08_never_runs_commands():
    src = open(os.path.join(os.path.dirname(__file__), "web08.py"), encoding="utf-8").read()
    assert not COMMAND_EXEC.search(src)
