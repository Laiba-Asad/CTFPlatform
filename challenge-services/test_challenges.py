"""Solve, no-leak, isolation and static tests for every challenge service.

Test flags deliberately avoid the real flag format so this file stays clean
under the "no flag literal in tracked files" static check. The services echo
whatever flag string they are given, so the format does not matter here.
"""
import base64
import importlib
import os
import re
import tempfile

import jwt
import pytest

import common

WEB = [f"web{i}" for i in range(1, 14)]


def make_config(cid, tmp, flag=None):
    return common.ChallengeConfig(
        challenge_id=cid,
        flag=flag or f"TESTFLAG-{cid}-7a3b",
        port=0,
        secrets={
            "jwt_secret": "test-jwt-secret-value",
            "otp": "0000",
            "phone": "555-000-1234",
            "visitor_key": "test-visitor-signing-key",
        },
        runtime_dir=os.path.join(tmp, cid),
    )


def app_for(cid, tmp, flag=None):
    module = importlib.import_module(f"web{int(cid[3:]):02d}")
    cfg = make_config(cid, tmp, flag)
    os.makedirs(cfg.runtime_dir, exist_ok=True)
    return module.create_app(cfg), cfg


@pytest.fixture
def tmp():
    with tempfile.TemporaryDirectory() as d:
        yield d


# --- Solve tests: run the intended technique and assert the flag comes back ---

def test_web1_cookie(tmp):
    app, cfg = app_for("web1", tmp)
    c = app.test_client()
    r = c.get("/")
    cookie = next(v for k, v in r.headers if k == "Set-Cookie" and v.startswith("secret_recipe="))
    value = cookie.split(";")[0].split("=", 1)[1]
    assert base64.b64decode(value).decode() == cfg.flag


def test_web2_robots_path(tmp):
    app, cfg = app_for("web2", tmp)
    c = app.test_client()
    assert "/secret-area/" in c.get("/robots.txt").get_data(as_text=True)
    assert cfg.flag in c.get("/secret-area/flag.txt").get_data(as_text=True)


def test_web3_sqli_then_dashboard(tmp):
    app, cfg = app_for("web3", tmp)
    c = app.test_client()
    r = c.post("/", data={"username": "admin' -- ", "password": "x"})
    assert r.status_code in (301, 302)
    assert cfg.flag in c.get("/dashboard").get_data(as_text=True)


def test_web4_xff(tmp):
    app, cfg = app_for("web4", tmp)
    c = app.test_client()
    assert cfg.flag in c.get("/", headers={"X-Forwarded-For": "127.0.0.1"}).get_data(as_text=True)


def test_web5_jwt_admin(tmp):
    app, cfg = app_for("web5", tmp)
    c = app.test_client()
    token = jwt.encode({"user": "admin"}, cfg.secrets["jwt_secret"], algorithm="HS256")
    c.set_cookie("session", token)
    assert cfg.flag in c.get("/").get_data(as_text=True)


def test_web6_backup(tmp):
    app, cfg = app_for("web6", tmp)
    assert cfg.flag in app.test_client().get("/main.js.bak").get_data(as_text=True)


def test_web7_lfi_backup(tmp):
    app, cfg = app_for("web7", tmp)
    assert cfg.flag in app.test_client().get("/?page=config.ini.bak").get_data(as_text=True)


def test_web8_injection_chars(tmp):
    app, cfg = app_for("web8", tmp)
    assert cfg.flag in app.test_client().post("/", data={"ip": "127.0.0.1; ls"}).get_data(as_text=True)


def test_web9_hidden_phone_param(tmp):
    app, cfg = app_for("web9", tmp)
    c = app.test_client()
    body = c.get("/verify").get_data(as_text=True)
    phone = re.search(r"phone_number=([0-9\-]+)", body).group(1)
    r = c.post("/verify", data={"otp": cfg.secrets["otp"], "phone_number": phone})
    assert cfg.flag in r.get_data(as_text=True)


def test_web10_idor(tmp):
    app, cfg = app_for("web10", tmp)
    assert cfg.flag in app.test_client().get("/profile/5").get_data(as_text=True)


def test_web11_stored_xss_own_message(tmp):
    app, cfg = app_for("web11", tmp)
    c = app.test_client()
    c.post("/", data={"message": "<script>steal()</script>"})
    assert "<script>steal()</script>" in c.get("/view_feedback").get_data(as_text=True)
    # admin_session cookie carries the base64 flag (intended trail)
    r = c.get("/view_feedback")
    cookie = next(v for k, v in r.headers if k == "Set-Cookie" and v.startswith("admin_session="))
    assert base64.b64decode(cookie.split(";")[0].split("=", 1)[1]).decode() == cfg.flag


def test_web12_traversal_to_flag(tmp):
    app, cfg = app_for("web12", tmp)
    assert cfg.flag in app.test_client().get("/download?file=flag.txt").get_data(as_text=True)


def test_web13_payload_reveals_flag(tmp):
    app, cfg = app_for("web13", tmp)
    r = app.test_client().get("/?q=<img src=x onerror=alert('XSS')>")
    assert cfg.flag in r.get_data(as_text=True)


# --- No-leak tests: entry pages must not expose the flag unsolved ---

@pytest.mark.parametrize("cid,paths", [
    ("web2", ["/", "/robots.txt"]),
    ("web3", ["/", "/dashboard"]),
    ("web4", ["/"]),
    ("web5", ["/"]),
    ("web6", ["/", "/main.js"]),
    ("web7", ["/", "/?page=news.txt"]),
    ("web8", ["/"]),
    ("web9", ["/", "/verify"]),
    ("web10", ["/", "/profile/1"]),
    ("web12", ["/", "/download?file=user_note.txt"]),
    ("web13", ["/", "/?q=hello"]),
])
def test_no_leak(cid, paths, tmp):
    app, cfg = app_for(cid, tmp)
    c = app.test_client()
    for path in paths:
        r = c.get(path)
        blob = r.get_data(as_text=True) + "".join(f"{k}:{v}" for k, v in r.headers)
        assert cfg.flag not in blob, f"{cid} leaked the flag at {path}"


def test_web1_body_has_no_plaintext_flag(tmp):
    app, cfg = app_for("web1", tmp)
    assert cfg.flag not in app.test_client().get("/").get_data(as_text=True)


# --- Isolation tests ---

def test_web11_visitor_isolation(tmp):
    app, _ = app_for("web11", tmp)
    a, b = app.test_client(), app.test_client()
    a.post("/", data={"message": "AAA-secret-from-a"})
    b.get("/")  # b establishes its own visitor cookie
    assert "AAA-secret-from-a" not in b.get("/view_feedback").get_data(as_text=True)


def test_web13_no_flag_without_payload(tmp):
    app, cfg = app_for("web13", tmp)
    for q in ["", "hello", "<b>hi</b>", "alert('nope')", "<script>alert(1)</script>"]:
        assert cfg.flag not in app.test_client().get(f"/?q={q}").get_data(as_text=True)


# --- Static checks ---

# Match real usage (imports/calls), not the words appearing in a comment.
COMMAND_EXEC = re.compile(r"\bimport\s+(subprocess|os\s*,|pty)\b|\bsubprocess\.\w|\bos\.(system|popen|exec\w*|spawn\w*)\s*\(|\bpty\.")
DEBUG_RELOADER = re.compile(r"debug\s*=\s*True|use_reloader\s*=\s*True|use_debugger\s*=\s*True")

SERVICE_FILES = [n for n in os.listdir(os.path.dirname(__file__))
                 if n.endswith(".py") and not n.startswith("test_")]


def test_web08_never_runs_commands():
    src = open(os.path.join(os.path.dirname(__file__), "web08.py"), encoding="utf-8").read()
    assert not COMMAND_EXEC.search(src)


def test_no_debug_or_reloader_anywhere():
    here = os.path.dirname(__file__)
    for name in SERVICE_FILES:
        src = open(os.path.join(here, name), encoding="utf-8").read()
        assert not DEBUG_RELOADER.search(src), name


def test_no_external_asset_urls_in_templates():
    tdir = os.path.join(os.path.dirname(__file__), "templates")
    for name in os.listdir(tdir):
        src = open(os.path.join(tdir, name), encoding="utf-8").read()
        assert "http://" not in src and "https://" not in src, name
