"""RETIRED: net2 "Whispers in the Wire" capture builder (removed from the board
before the 22 October 2026 event). Kept so it can be restored: move build_net2
and the split check back into generate_captures.py and add net2 to the seed.

Telnet session with the flag split across several server lines; the whole flag
never appears contiguously in the raw bytes.
"""
from scapy.layers.inet import IP, TCP  # noqa: F401  (used via TCPSession)


def split3(flag: str) -> list:
    third = max(1, len(flag) // 3)
    return [flag[:third], flag[third:2 * third], flag[2 * third:]]


def build_net2(session_cls, flag: str):
    """session_cls is generate_captures.TCPSession."""
    parts = split3(flag)
    s = session_cls("10.0.0.4", "10.0.0.5", 2048, 23)
    s.handshake()
    s.server("Login: ")
    s.client("operator\r\n")
    s.server("Password: ")
    s.client("********\r\n")
    s.server("Last login: Tue from 10.0.0.9\r\n")
    s.server(f"Welcome. The first fragment is {parts[0]} ...\r\n")
    s.client("go on\r\n")
    s.server(f"... the middle looks like {parts[1]} ...\r\n")
    s.server(f"... and it ends with {parts[2]}\r\n")
    s.client("logout\r\n")
    s.server("Connection closed.\r\n")
    return s.packets


def verify_split(stream: bytes, raw: bytes, flag: str) -> None:
    """Every fragment appears in order in the stream; the whole flag never in the raw bytes."""
    pos = -1
    for part in split3(flag):
        found = stream.find(part.encode(), pos + 1)
        if found <= pos:
            raise SystemExit("[FAIL] net2: fragments not recoverable in order from the stream")
        pos = found
    if flag.encode() in raw:
        raise SystemExit("[FAIL] net2: flag appears as one contiguous string in the raw bytes")
