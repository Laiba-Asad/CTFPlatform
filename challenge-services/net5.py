"""net5 - Plain Text. An in-site Capture Viewer that replaces Wireshark.

Intended trail: the viewer (browser only) shows ~40 packets of a fictional
intranet. A text filter, a hex/ASCII payload view per packet, and a "Follow
stream" button. One HTTP login stream sends a password and the flag in plain
text. Filter for it, follow the stream, read it.

The flag is built into the capture at startup from the env flag and is only ever
sent as hex byte arrays (payload_hex), so it is never a searchable string in the
HTML or the JS. No pcap file and no download.
"""
from flask import jsonify, render_template

from common import ChallengeConfig, base_app

# A fictional intranet: a few hosts, a stream id per conversation.
CLIENT, SERVER, DNS, GW = "10.14.0.23", "10.14.0.9", "10.14.0.2", "10.14.0.1"


def _hex(text: str) -> str:
    return text.encode().hex()


def build_capture(flag: str) -> list:
    """~40 packets. Only stream 7 (the HTTP login) carries readable text + the flag."""
    pk = []
    t = [0.0]

    def add(src, dst, proto, info, stream=None, payload=""):
        t[0] += round(0.01 + (len(pk) % 5) * 0.003, 4)
        pk.append({
            "no": len(pk) + 1, "time": round(t[0], 4), "src": src, "dst": dst,
            "proto": proto, "info": info, "stream": stream, "payload_hex": _hex(payload),
        })

    # Background noise: ARP, DNS, NTP, TLS - no readable secrets.
    add(GW, "ff:ff:ff:ff:ff:ff", "ARP", "Who has 10.14.0.9? Tell 10.14.0.1")
    add(SERVER, GW, "ARP", "10.14.0.9 is at 00:1b:44:11:3a:b7")
    add(CLIENT, DNS, "DNS", "Standard query A intranet.local")
    add(DNS, CLIENT, "DNS", "Standard query response A 10.14.0.9")
    for i in range(3):
        add(CLIENT, "10.14.0.50", "NTP", f"NTP Version 4, client, seq {i}")
    # A TLS conversation (stream 3): handshake bytes, nothing readable.
    add(CLIENT, "10.14.0.60", "TCP", "50122 > 443 [SYN]", stream=3)
    add("10.14.0.60", CLIENT, "TCP", "443 > 50122 [SYN, ACK]", stream=3)
    add(CLIENT, "10.14.0.60", "TLSv1.2", "Client Hello", stream=3, payload="\x16\x03\x01\x02\x00\x01\x00\x01\xfc")
    add("10.14.0.60", CLIENT, "TLSv1.2", "Server Hello, Certificate", stream=3, payload="\x16\x03\x03\x00\x52\x02\x00")
    add(CLIENT, "10.14.0.60", "TLSv1.2", "Application Data", stream=3, payload="\x17\x03\x03\x01\x19\x9a\x3f")
    # More noise between the interesting hops.
    for i in range(4):
        add(SERVER, "10.14.0.80", "TCP", f"8080 > 55000 [ACK] seq={i}", stream=5)

    # Stream 7: the plain HTTP login. Password and flag travel in the clear.
    req = (
        "POST /login HTTP/1.1\r\n"
        "Host: intranet.local\r\n"
        "Content-Type: application/x-www-form-urlencoded\r\n"
        "Content-Length: 41\r\n\r\n"
        "username=rwilson&password=hunter2spring"
    )
    resp = (
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<html><body><h1>Welcome back, rwilson</h1>"
        f"<p>Your access token is {flag}</p></body></html>"
    )
    add(CLIENT, SERVER, "TCP", "50140 > 80 [SYN]", stream=7)
    add(SERVER, CLIENT, "TCP", "80 > 50140 [SYN, ACK]", stream=7)
    add(CLIENT, SERVER, "TCP", "50140 > 80 [ACK]", stream=7)
    add(CLIENT, SERVER, "HTTP", "POST /login HTTP/1.1 (application/x-www-form-urlencoded)", stream=7, payload=req)
    add(SERVER, CLIENT, "TCP", "80 > 50140 [ACK]", stream=7)
    add(SERVER, CLIENT, "HTTP", "HTTP/1.1 200 OK (text/html)", stream=7, payload=resp)
    add(CLIENT, SERVER, "TCP", "50140 > 80 [FIN, ACK]", stream=7)
    add(SERVER, CLIENT, "TCP", "80 > 50140 [FIN, ACK]", stream=7)

    # Trailing noise.
    for i in range(6):
        add(DNS, CLIENT, "DNS", f"Standard query response A 10.14.0.{100 + i}")
    return pk


VIEWER_JS = r"""// Capture Viewer - renders packets, decodes hex payloads, follows a stream.
(function () {
  var packets = [];
  var selected = null;

  function hexToText(hex) {
    var out = '';
    for (var i = 0; i < hex.length; i += 2) {
      var code = parseInt(hex.substr(i, 2), 16);
      out += (code >= 32 && code < 127) || code === 10 || code === 13 || code === 9
        ? String.fromCharCode(code) : '.';
    }
    return out;
  }

  function hexDump(hex) {
    var lines = [];
    for (var i = 0; i < hex.length; i += 32) {
      var chunk = hex.substr(i, 32);
      var pairs = (chunk.match(/.{1,2}/g) || []).join(' ');
      lines.push(pairs.padEnd(48, ' ') + ' ' + hexToText(chunk));
    }
    return lines.join('\n') || '(no payload)';
  }

  function render(list) {
    var rows = document.getElementById('rows');
    rows.innerHTML = '';
    list.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.className = 'packet' + (selected && selected.no === p.no ? ' selected' : '');
      [p.no, p.time, p.src, p.dst, p.proto, p.info].forEach(function (v) {
        var td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      tr.addEventListener('click', function () { select(p); });
      rows.appendChild(tr);
    });
    document.getElementById('count').textContent = list.length + ' of ' + packets.length + ' packets';
  }

  function select(p) {
    selected = p;
    document.getElementById('detail').style.display = 'block';
    document.getElementById('d-no').textContent = p.no;
    document.getElementById('d-stream').textContent = p.stream != null ? '(stream ' + p.stream + ')' : '(no stream)';
    document.getElementById('d-payload').textContent = hexDump(p.payload_hex);
    applyFilter();
  }

  function applyFilter() {
    var q = document.getElementById('filter').value.toLowerCase();
    render(packets.filter(function (p) {
      if (!q) return true;
      return [p.src, p.dst, p.proto, p.info].join(' ').toLowerCase().indexOf(q) !== -1
        || hexToText(p.payload_hex).toLowerCase().indexOf(q) !== -1;
    }));
  }

  document.getElementById('follow').addEventListener('click', function () {
    if (!selected || selected.stream == null) return;
    var stream = packets.filter(function (p) { return p.stream === selected.stream && p.payload_hex; });
    var text = stream.map(function (p) { return hexToText(p.payload_hex); }).join('\n\n');
    document.getElementById('d-no').textContent = selected.no;
    document.getElementById('d-stream').textContent = '(following stream ' + selected.stream + ')';
    document.getElementById('d-payload').textContent = text || '(this stream carries no readable payload)';
  });

  document.getElementById('filter').addEventListener('input', applyFilter);

  fetch('/api/capture').then(function (r) { return r.json(); }).then(function (data) {
    packets = data.packets;
    render(packets);
  });
})();
"""


def create_app(config: ChallengeConfig):
    app = base_app(config)
    packets = build_capture(config.flag)

    @app.route("/")
    def viewer():
        return render_template("net5_viewer.html")

    @app.route("/assets/viewer.js")
    def viewer_js():
        from flask import Response
        return Response(VIEWER_JS, mimetype="application/javascript", headers={"Cache-Control": "no-store"})

    @app.route("/api/capture")
    def capture():
        resp = jsonify(packets=packets)
        resp.headers["Cache-Control"] = "no-store"
        return resp

    return app
