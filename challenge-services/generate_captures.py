"""Generate the net1/net2 capture files at setup time (never per request).

Builds real TCP sessions (three-way handshake, monotonic seq/ack per side,
consistent ports/addresses) so Wireshark "Follow TCP Stream" reconstructs each
conversation. Flags are read from .flags.env, never hard-coded. Output is
written as true pcapng into generated/captures/ (git-ignored), then read back
and verified.

    python generate_captures.py
"""
import os
import sys

from scapy.layers.inet import IP, TCP
from scapy.packet import Raw
from scapy.utils import PcapNgWriter, rdpcap

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "generated", "captures")


def load_flags_env() -> dict:
    path = os.path.join(HERE, ".flags.env")
    if not os.path.exists(path):
        print("Missing .flags.env. Run build_flags_env.py first.", file=sys.stderr)
        sys.exit(1)
    env = {}
    for line in open(path, "r", encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


class TCPSession:
    """Accumulates a correctly-sequenced two-way TCP conversation."""

    def __init__(self, client_ip, server_ip, client_port, server_port):
        self.cip, self.sip = client_ip, server_ip
        self.cport, self.sport = client_port, server_port
        self.cseq, self.sseq = 1000, 5000
        self.packets = []

    def handshake(self):
        self.packets.append(IP(src=self.cip, dst=self.sip) /
                            TCP(sport=self.cport, dport=self.sport, flags="S", seq=self.cseq))
        self.packets.append(IP(src=self.sip, dst=self.cip) /
                            TCP(sport=self.sport, dport=self.cport, flags="SA",
                                seq=self.sseq, ack=self.cseq + 1))
        self.cseq += 1
        self.sseq += 1
        self.packets.append(IP(src=self.cip, dst=self.sip) /
                            TCP(sport=self.cport, dport=self.sport, flags="A",
                                seq=self.cseq, ack=self.sseq))

    def _send(self, from_client: bool, payload: str):
        data = payload.encode()
        if from_client:
            pkt = IP(src=self.cip, dst=self.sip) / TCP(
                sport=self.cport, dport=self.sport, flags="PA", seq=self.cseq, ack=self.sseq) / Raw(data)
            self.cseq += len(data)
        else:
            pkt = IP(src=self.sip, dst=self.cip) / TCP(
                sport=self.sport, dport=self.cport, flags="PA", seq=self.sseq, ack=self.cseq) / Raw(data)
            self.sseq += len(data)
        self.packets.append(pkt)

    def client(self, payload: str):
        self._send(True, payload)

    def server(self, payload: str):
        self._send(False, payload)


def build_net1(flag: str) -> list:
    """FTP session where the password line carries the flag in plain text."""
    s = TCPSession("10.0.0.1", "10.0.0.2", 1025, 21)
    s.handshake()
    s.server("220 FTP Server ready.\r\n")
    s.client("USER anonymous\r\n")
    s.server("331 Please specify the password.\r\n")
    s.client(f"PASS {flag}\r\n")
    s.server("230 Login successful.\r\n")
    s.client("QUIT\r\n")
    s.server("221 Goodbye.\r\n")
    return s.packets


def split3(flag: str) -> list:
    third = max(1, len(flag) // 3)
    return [flag[:third], flag[third:2 * third], flag[2 * third:]]


def build_net2(flag: str) -> list:
    """Telnet session with the flag split across several server lines."""
    parts = split3(flag)
    s = TCPSession("10.0.0.4", "10.0.0.5", 2048, 23)
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
    return s.packets, flag


def follow_stream(packets, src_ip: str) -> bytes:
    """Reassemble one direction (packets sent by src_ip), ordered by sequence."""
    segments = []
    for pkt in packets:
        if IP in pkt and TCP in pkt and Raw in pkt and pkt[IP].src == src_ip:
            segments.append((pkt[TCP].seq, bytes(pkt[Raw].load)))
    segments.sort(key=lambda x: x[0])
    return b"".join(data for _, data in segments)


def write_and_verify(name: str, packets, flag: str, src_ip: str, split_check: bool):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with PcapNgWriter(path) as writer:
        for pkt in packets:
            writer.write(pkt)

    back = rdpcap(path)
    stream = follow_stream(back, src_ip)
    raw = open(path, "rb").read()

    if not split_check:
        if flag.encode() not in stream:
            raise SystemExit(f"[FAIL] {name}: flag not recoverable from the reassembled stream")
        print(f"[OK] {name}: {len(back)} packets, flag recoverable from the stream")
        return

    # Split challenge: every fragment appears in order in the reassembled stream,
    # but the whole flag never appears contiguously anywhere in the raw bytes.
    pos, ordered = -1, True
    for part in split3(flag):
        found = stream.find(part.encode(), pos + 1)
        if found <= pos:
            ordered = False
            break
        pos = found
    if not ordered:
        raise SystemExit(f"[FAIL] {name}: fragments not recoverable in order from the stream")
    if flag.encode() in raw:
        raise SystemExit(f"[FAIL] {name}: flag appears as one contiguous string in the raw bytes")
    print(f"[OK] {name}: {len(back)} packets, fragments recoverable in order; "
          "whole flag never contiguous in the bytes")


def main() -> int:
    env = load_flags_env()
    net1_flag = env.get("FLAG_net1")
    net2_flag = env.get("FLAG_net2")
    if not net1_flag or not net2_flag:
        print("FLAG_net1 / FLAG_net2 missing from .flags.env", file=sys.stderr)
        return 1
    # net1: flag is in the client's PASS line (10.0.0.1 -> server).
    write_and_verify("net1.pcapng", build_net1(net1_flag), net1_flag, "10.0.0.1", split_check=False)
    # net2: flag fragments are in the server's lines (10.0.0.5 -> client).
    pkts2, _ = build_net2(net2_flag)
    write_and_verify("net2.pcapng", pkts2, net2_flag, "10.0.0.5", split_check=True)
    print("Captures written to", OUT_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
