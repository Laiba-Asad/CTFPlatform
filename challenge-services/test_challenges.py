"""Solve, no-leak, cookie-isolation and static tests for every active challenge.

The whole board is browser-only: each solve test runs the exact HTTP the
intended browser/DevTools action produces (enable a button and click it, edit a
hidden field, set a cookie, read a /api endpoint, decode the net5 capture). The
real-browser DevTools path is additionally covered by the Playwright suite.

Test flags deliberately avoid the real flag format so this file stays clean
under the "no flag literal in tracked files" static check. The services echo
whatever flag string they are given, so the format does not matter here.
"""
import base64
import codecs
import http.client
import importlib
import os
import re
import socket
import subprocess
import sys
import tempfile
import urllib.parse

import pytest
from waitress.server import create_server

import common
import serve

HERE = os.path.dirname(os.path.abspath(__file__))
# Every id ever retired (Phase 5 + Phase 6). None may be registered or tested.
RETIRED = {"web3", "web4", "web5", "web6", "web7", "web8", "web9", "web10",
           "web11", "web12", "web13", "net1", "net2", "net3", "net4"}
ACTIVE = ["web1", "web2", "web14", "web15", "web16", "web17", "web18",
          "web19", "web20", "web21", "web22", "web23", "web24", "web25", "net5"]


def make_config(cid, tmp, flag=None):
    return common.ChallengeConfig(
        challenge_id=cid,
        flag=flag or f"TESTFLAG-{cid}-7a3b",
        port=0,
        secrets={"visitor_key": "test-visitor-signing-key", "password": "river-copper-lantern42"},
        runtime_dir=os.path.join(tmp, cid),
    )


def app_for(cid, tmp, flag=None):
    module = importlib.import_module(serve.MODULES[cid])
    cfg = make_config(cid, tmp, flag)
    os.makedirs(cfg.runtime_dir, exist_ok=True)
    return module.create_app(cfg), cfg


@pytest.fixture
def tmp():
    with tempfile.TemporaryDirectory() as d:
        yield d


class Live:
    """A challenge app served by waitress on a free temporary port."""

    def __init__(self, app):
        self.server = create_server(app, host="127.0.0.1", port=0, threads=4)
        self.port = self.server.effective_port
        import threading
        self.thread = threading.Thread(target=self.server.run, daemon=True)
        self.thread.start()

    def request(self, method, path, form=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        body = urllib.parse.urlencode(form) if form is not None else None
        hdrs = dict(headers or {})
        if form is not None:
            hdrs["Content-Type"] = "application/x-www-form-urlencoded"
        conn.request(method, path, body=body, headers=hdrs)
        r = conn.getresponse()
        data = r.read().decode("utf-8", "replace")
        result = (r.status, dict(r.getheaders()), data)
        conn.close()
        return result

    def close(self):
        self.server.close()


@pytest.fixture
def live(tmp):
    servers = []

    def start(cid, flag=None):
        app, cfg = app_for(cid, tmp, flag)
        srv = Live(app)
        servers.append(srv)
        return srv, cfg

    yield start
    for srv in servers:
        srv.close()


def leak_blob(status_headers_body):
    _status, headers, body = status_headers_body
    return body + "".join(f"{k}:{v}" for k, v in headers.items())


# --- Solve tests: the exact HTTP the intended browser action produces ---

def test_web1_cookie(tmp):
    app, cfg = app_for("web1", tmp)
    r = app.test_client().get("/")
    cookie = next(v for k, v in r.headers if k == "Set-Cookie" and v.startswith("secret_recipe="))
    assert base64.b64decode(cookie.split(";")[0].split("=", 1)[1]).decode() == cfg.flag


def test_web2_robots_path(tmp):
    app, cfg = app_for("web2", tmp)
    c = app.test_client()
    robots = c.get("/robots.txt").get_data(as_text=True)
    assert "/flag.txt" in robots and "secret-area" not in robots
    assert cfg.flag in c.get("/flag.txt").get_data(as_text=True)


def test_web2_old_secret_area_is_gone(tmp):
    app, _cfg = app_for("web2", tmp)
    c = app.test_client()
    assert c.get("/secret-area/").status_code == 404
    assert c.get("/secret-area/flag.txt").status_code == 404


def test_web14_view_source_comment(live):
    srv, cfg = live("web14")
    _s, _h, body = srv.request("GET", "/")
    assert any(cfg.flag in c for c in re.findall(r"<!--(.*?)-->", body, re.S))


def test_web15_decode_script_string(live):
    srv, cfg = live("web15")
    _s, _h, page = srv.request("GET", "/")
    src = re.search(r'<script src="([^"]+)"', page).group(1)
    _s, _h, script = srv.request("GET", src)
    decoded = [base64.b64decode(c).decode(errors="replace") for c in re.findall(r'"([A-Za-z0-9+/=]{16,})"', script)]
    assert cfg.flag in decoded


def test_web16_redirect_header(live):
    srv, cfg = live("web16")
    status, headers, _b = srv.request("GET", "/")
    assert status == 302 and headers["Location"].endswith("/api/status")
    status, headers, body = srv.request("GET", "/api/status")
    assert status == 302 and headers.get("X-Status-Token") == cfg.flag and cfg.flag not in body


def test_web17_hidden_price_field(live):
    srv, cfg = live("web17")
    _s, _h, page = srv.request("GET", "/")
    item = re.search(r'name="item" value="([^"]+)"', page).group(1)
    assert re.search(r'type="hidden" name="price" value="[0-9.]+"', page), "price is a hidden field"
    for price in ["1", "0.50", "0"]:
        status, _h, body = srv.request("POST", "/checkout", form={"item": item, "price": price})
        assert status == 200 and cfg.flag in body, price


def test_web18_peel_two_layers(live):
    srv, cfg = live("web18")
    _s, _h, page = srv.request("GET", "/")
    noise = re.search(r"<pre>([A-Za-z0-9+/=]+)</pre>", page).group(1)
    # Intended Toolkit steps: Base64 decode, then ROT13.
    assert codecs.decode(base64.b64decode(noise).decode(), "rot_13") == cfg.flag


def test_web19_hidden_text_in_html(live):
    srv, cfg = live("web19")
    _s, _h, body = srv.request("GET", "/")
    assert cfg.flag in body, "Select All / Inspect reveals the CSS-hidden text"


def test_web20_enable_button_then_claim(live):
    srv, cfg = live("web20")
    _s, _h, page = srv.request("GET", "/")
    assert re.search(r"<button[^>]*\bdisabled\b", page), "the Claim button ships disabled"
    assert cfg.flag not in page
    status, _h, body = srv.request("POST", "/claim")
    assert status == 200 and cfg.flag in body


def test_web21_note_in_local_storage(live):
    srv, cfg = live("web21")
    status, _h, body = srv.request("GET", "/api/note")
    assert status == 200 and cfg.flag in body
    assert "note_to_self" in srv.request("GET", "/assets/locker.js")[2]


def test_web22_console_function_fetches_flag(live):
    srv, cfg = live("web22")
    _s, _h, script = srv.request("GET", "/assets/whisper.js")
    assert "whisper()" in script and cfg.flag not in script
    status, _h, body = srv.request("GET", "/api/whisper")
    assert status == 200 and cfg.flag in body


def test_web23_password_from_script_opens_door(live):
    srv, cfg = live("web23")
    _s, _h, script = srv.request("GET", "/assets/gate.js")
    pieces = re.search(r"var pieces = (\[[^\]]*\]);", script).group(1)
    import json
    password = "".join(json.loads(pieces))
    assert cfg.flag not in script
    # POST the reconstructed password as JSON, the way the page does.
    conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=5)
    conn.request("POST", "/api/open", body=json.dumps({"password": password}),
                 headers={"Content-Type": "application/json"})
    resp = conn.getresponse()
    out = resp.read().decode()
    conn.close()
    assert resp.status == 200 and cfg.flag in out


def test_web24_staff_cookie_shows_flag(live):
    srv, cfg = live("web24")
    status, headers, body = srv.request("GET", "/")
    assert status == 200 and cfg.flag not in body
    assert "badge_level=visitor" in headers.get("Set-Cookie", "")
    _s, _h, staff = srv.request("GET", "/", headers={"Cookie": "badge_level=staff"})
    assert cfg.flag in staff


def test_web25_organizer_ticket_idor(live):
    srv, cfg = live("web25")
    assert cfg.flag not in leak_blob(srv.request("GET", "/ticket/1042"))
    status, _h, body = srv.request("GET", "/ticket/1000")
    assert status == 200 and cfg.flag in body


def test_net5_follow_login_stream(live):
    srv, cfg = live("net5")
    import json
    _s, _h, body = srv.request("GET", "/api/capture")
    packets = json.loads(body)["packets"]
    # Follow the stream whose payloads contain a login (as the viewer's button does).
    def decode(hexs):
        return bytes.fromhex(hexs).decode("latin1")
    streams = {}
    for p in packets:
        if p["stream"] is not None and p["payload_hex"]:
            streams.setdefault(p["stream"], []).append(decode(p["payload_hex"]))
    login = next(s for s in streams.values() if any("password=" in part for part in s))
    assert cfg.flag in "".join(login)


# --- No-leak tests: entry surfaces must not expose the flag unsolved ---

@pytest.mark.parametrize("cid,paths", [
    ("web2", ["/", "/robots.txt"]),
    ("web15", ["/"]),
    ("web16", ["/", "/status", "/api"]),
    ("web17", ["/", "/checkout"]),
    ("web18", ["/", "/robots.txt"]),
    ("web19", []),  # web19's flag is intentionally in the HTML (hidden): checked separately
    ("web20", ["/"]),
    ("web21", ["/", "/assets/locker.js"]),
    ("web22", ["/", "/assets/whisper.js"]),
    ("web23", ["/", "/assets/gate.js"]),
    ("web24", ["/"]),
    ("web25", ["/ticket/1042", "/ticket/1041", "/ticket/1050"]),
    ("net5", ["/", "/assets/viewer.js"]),
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


def test_web14_flag_only_inside_the_comment(live):
    srv, cfg = live("web14")
    _s, headers, body = srv.request("GET", "/")
    assert cfg.flag not in re.sub(r"<!--.*?-->", "", body, flags=re.S)
    assert cfg.flag not in "".join(f"{k}:{v}" for k, v in headers.items())


def test_web15_flag_never_in_plain_text(live):
    srv, cfg = live("web15")
    encoded = base64.b64encode(cfg.flag.encode()).decode()
    page = leak_blob(srv.request("GET", "/"))
    assert cfg.flag not in page and encoded not in page
    assert cfg.flag not in leak_blob(srv.request("GET", "/assets/app.js"))


def test_web16_flag_only_in_the_api_status_redirect_header(live):
    srv, cfg = live("web16")
    for path in ["/", "/status", "/api", "/favicon.ico"]:
        assert cfg.flag not in leak_blob(srv.request("GET", path)), path
    _s, headers, body = srv.request("GET", "/api/status")
    assert cfg.flag not in body
    assert [k for k, v in headers.items() if cfg.flag in v] == ["X-Status-Token"]


def test_web17_no_flag_at_a_real_price(live):
    srv, cfg = live("web17")
    assert cfg.flag not in leak_blob(srv.request("GET", "/"))
    for form in [{"item": "golden-keyboard", "price": "4999.00"},
                 {"item": "golden-keyboard", "price": "1.01"},
                 {"item": "golden-keyboard", "price": "abc"},
                 {"item": "golden-keyboard", "price": "nan"},
                 {"item": "golden-keyboard"},
                 {"item": "other", "price": "0"}]:
        assert cfg.flag not in leak_blob(srv.request("POST", "/checkout", form=form)), form


def test_web18_only_the_final_base64_is_served(live):
    import web18
    srv, cfg = live("web18")
    page = leak_blob(srv.request("GET", "/"))
    rot13 = codecs.encode(cfg.flag, "rot_13")
    assert web18.encode_layers(cfg.flag) in page  # the final Base64 text is shown
    # The plain flag, the ROT13 intermediate, and a single-layer Base64 of the
    # plain flag must never appear.
    for layer in (cfg.flag, rot13, base64.b64encode(cfg.flag.encode()).decode()):
        assert layer not in page


def test_web19_flag_hidden_not_in_headers_or_js(live):
    srv, cfg = live("web19")
    _s, headers, _b = srv.request("GET", "/")
    assert cfg.flag not in "".join(f"{k}:{v}" for k, v in headers.items())


def test_web20_no_flag_before_claim(live):
    srv, cfg = live("web20")
    assert cfg.flag not in leak_blob(srv.request("GET", "/"))


def test_web21_flag_only_in_the_note_endpoint(live):
    srv, cfg = live("web21")
    assert cfg.flag not in leak_blob(srv.request("GET", "/"))
    assert cfg.flag not in leak_blob(srv.request("GET", "/assets/locker.js"))
    assert cfg.flag in srv.request("GET", "/api/note")[2]


def test_web22_flag_only_in_the_whisper_endpoint(live):
    srv, cfg = live("web22")
    assert cfg.flag not in leak_blob(srv.request("GET", "/"))
    assert cfg.flag not in leak_blob(srv.request("GET", "/assets/whisper.js"))


def test_web23_wrong_password_stays_shut(live):
    srv, cfg = live("web23")
    assert cfg.flag not in leak_blob(srv.request("GET", "/"))
    assert cfg.flag not in leak_blob(srv.request("GET", "/assets/gate.js"))
    import json
    conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=5)
    conn.request("POST", "/api/open", body=json.dumps({"password": "wrong"}), headers={"Content-Type": "application/json"})
    resp = conn.getresponse()
    out = resp.read().decode()
    conn.close()
    assert resp.status == 403 and cfg.flag not in out


def test_web24_no_flag_for_visitor(live):
    srv, cfg = live("web24")
    assert cfg.flag not in leak_blob(srv.request("GET", "/"))
    assert cfg.flag not in leak_blob(srv.request("GET", "/", headers={"Cookie": "badge_level=visitor"}))


def test_web25_no_flag_on_other_tickets(live):
    srv, cfg = live("web25")
    for n in (1042, 1041, 1043, 1050, 1001):
        assert cfg.flag not in leak_blob(srv.request("GET", f"/ticket/{n}")), n
    assert srv.request("GET", "/ticket/1051")[0] == 404


def test_net5_flag_not_a_searchable_string_outside_the_stream_hex(live):
    srv, cfg = live("net5")
    # The flag must not appear literally in the page, the JS, or any info/field text.
    assert cfg.flag not in leak_blob(srv.request("GET", "/"))
    assert cfg.flag not in leak_blob(srv.request("GET", "/assets/viewer.js"))
    import json
    body = srv.request("GET", "/api/capture")[2]
    packets = json.loads(body)["packets"]
    assert cfg.flag not in json.dumps([{k: v for k, v in p.items() if k != "payload_hex"} for p in packets])
    # It only appears once its hex payload is decoded.
    assert cfg.flag.encode().hex() in body


# --- Cookie isolation: no service may touch a platform cookie ---

PLATFORM_COOKIES = ["cydemic_ctf_sid", "cydemic_csrf", "cydemic_ctf_admin_sid", "cydemic_admin_csrf"]


@pytest.mark.parametrize("cid", ACTIVE)
def test_service_never_sets_a_platform_cookie(cid, tmp):
    app, _cfg = app_for(cid, tmp)
    c = app.test_client()
    for path in ["/", "/robots.txt", "/api/note", "/api/whisper", "/api/status", "/ticket/1000"]:
        r = c.get(path)
        setc = "; ".join(v for k, v in r.headers if k == "Set-Cookie")
        for name in PLATFORM_COOKIES:
            assert name not in setc, f"{cid} set a platform cookie at {path}"


def test_only_known_cookie_names_are_used(tmp):
    # The only cookies any service sets are its own uniquely named ones.
    allowed = {"secret_recipe", "badge_level"}
    for cid in ACTIVE:
        app, _cfg = app_for(cid, tmp)
        c = app.test_client()
        for path in ["/", "/ticket/1000"]:
            for k, v in c.get(path).headers:
                if k == "Set-Cookie":
                    name = v.split("=", 1)[0]
                    assert name in allowed, f"{cid} set unexpected cookie {name}"


# --- Entry point: serve.py takes port, flag and secrets only from the environment ---

def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_serve_py_runs_web23_with_env_secret(tmp):
    port = _free_port()
    env = {
        "PATH": os.environ.get("PATH", ""), "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
        "CHALLENGE_ID": "web23", "CHALLENGE_FLAG": "TESTFLAG-web23-env", "PORT": str(port),
        "RUNTIME_DIR": os.path.join(tmp, "web23"), "CHALLENGE_SECRET_PASSWORD": "alpha-beta-gamma10",
    }
    proc = subprocess.Popen([sys.executable, "serve.py"], cwd=HERE, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        import time
        import json
        out = ""
        for _ in range(80):
            try:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
                conn.request("POST", "/api/open", body=json.dumps({"password": "alpha-beta-gamma10"}),
                             headers={"Content-Type": "application/json"})
                out = conn.getresponse().read().decode()
                conn.close()
                break
            except OSError:
                time.sleep(0.1)
        assert "TESTFLAG-web23-env" in out
    finally:
        proc.terminate()
        proc.wait(timeout=10)


# --- Static checks ---

COMMAND_EXEC = re.compile(r"\bimport\s+(subprocess|os\s*,|pty)\b|\bsubprocess\.\w|\bos\.(system|popen|exec\w*|spawn\w*)\s*\(|\bpty\.")
DEBUG_RELOADER = re.compile(r"debug\s*=\s*True|use_reloader\s*=\s*True|use_debugger\s*=\s*True")
SERVICE_FILES = [n for n in os.listdir(HERE) if n.endswith(".py") and not n.startswith("test_")]


def test_active_modules_exist_and_exclude_retired():
    assert set(serve.MODULES) == set(ACTIVE), "serve.MODULES must list exactly the active challenges"
    assert not RETIRED & set(serve.MODULES), "a retired challenge is still registered in serve.py"
    for cid, module in serve.MODULES.items():
        assert os.path.exists(os.path.join(HERE, f"{module}.py")), cid
        assert callable(importlib.import_module(module).create_app), cid


def test_services_never_run_commands():
    for module in serve.MODULES.values():
        src = open(os.path.join(HERE, f"{module}.py"), encoding="utf-8").read()
        assert not COMMAND_EXEC.search(src), module


def test_no_debug_or_reloader_anywhere():
    for name in SERVICE_FILES:
        src = open(os.path.join(HERE, name), encoding="utf-8").read()
        assert not DEBUG_RELOADER.search(src), name


def test_no_external_asset_urls_in_templates():
    tdir = os.path.join(HERE, "templates")
    for name in os.listdir(tdir):
        src = open(os.path.join(tdir, name), encoding="utf-8").read()
        assert "http://" not in src and "https://" not in src, name


# --- Browser-only audit: every active challenge is solvable with a browser + DevTools ---

# How each active challenge is solved. Tags must all be in BROWSER_ONLY; none may
# be in NEEDS_TOOL. Adding a challenge that needs an outside tool fails this test.
SOLUTION_TAGS = {
    "web1": {"devtools-application"},        # read a cookie
    "web2": {"browser-url"},                 # robots.txt then a path
    "web14": {"view-source"},                # HTML comment
    "web15": {"devtools-sources", "toolkit"},  # read a script, decode Base64 in the in-site Toolkit
    "web16": {"devtools-network"},           # response header (Preserve log)
    "web17": {"devtools-elements"},          # edit a hidden form field
    "web18": {"toolkit"},                    # decode layers in the in-site Toolkit
    "web19": {"view-source", "devtools-elements"},  # CSS-hidden text
    "web20": {"devtools-elements"},          # enable a disabled button
    "web21": {"devtools-application"},       # localStorage
    "web22": {"devtools-console"},           # call a console function
    "web23": {"devtools-sources"},           # read the client-side password
    "web24": {"devtools-application"},       # edit a cookie
    "web25": {"browser-url"},                # change the id in the URL
    "net5": {"in-site-viewer"},              # the Capture Viewer replaces Wireshark
}

BROWSER_ONLY = {
    "view-source", "browser-url", "devtools-elements", "devtools-console",
    "devtools-network", "devtools-sources", "devtools-application", "toolkit", "in-site-viewer",
}
# Anything that would need software to install or a non-browser action.
NEEDS_TOOL = {"burp", "curl", "nmap", "ncat", "wireshark", "cyberchef", "raw-tcp",
              "custom-request-header", "file-download", "installed-tool"}


def test_browser_only_audit():
    assert set(SOLUTION_TAGS) == set(ACTIVE), "every active challenge needs an audited solution"
    for cid, tags in SOLUTION_TAGS.items():
        assert tags, cid
        assert tags <= BROWSER_ONLY, f"{cid} solution uses a non-browser tag: {tags - BROWSER_ONLY}"
        assert not (tags & NEEDS_TOOL), f"{cid} needs an installed tool: {tags & NEEDS_TOOL}"
