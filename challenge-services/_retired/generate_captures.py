"""Generate the net1 capture file at setup time (never per request).

Builds real TCP sessions (three-way handshake, monotonic seq/ack per side,
consistent ports/addresses, FIN teardown) so Wireshark "Follow TCP Stream"
reconstructs each conversation. Flags are read from .flags.env, never
hard-coded. Output is written as true pcapng (hence the .pcapng extension) into
generated/captures/ (git-ignored), then read back and verified.

    python generate_captures.py

(The retired net2 builder lives in _retired/net2_capture.py. net3 is now a live
TCP service, see net3.py.)
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

    def _pkt(self, from_client: bool, flags: str, payload: bytes = b""):
        if from_client:
            pkt = IP(src=self.cip, dst=self.sip) / TCP(
                sport=self.cport, dport=self.sport, flags=flags, seq=self.cseq, ack=self.sseq)
        else:
            pkt = IP(src=self.sip, dst=self.cip) / TCP(
                sport=self.sport, dport=self.cport, flags=flags, seq=self.sseq, ack=self.cseq)
        if payload:
            pkt = pkt / Raw(payload)
        self.packets.append(pkt)

    def handshake(self):
        self.packets.append(IP(src=self.cip, dst=self.sip) /
                            TCP(sport=self.cport, dport=self.sport, flags="S", seq=self.cseq))
        self.packets.append(IP(src=self.sip, dst=self.cip) /
                            TCP(sport=self.sport, dport=self.cport, flags="SA",
                                seq=self.sseq, ack=self.cseq + 1))
        self.cseq += 1
        self.sseq += 1
        self._pkt(True, "A")

    def _send(self, from_client: bool, payload: str):
        data = payload.encode()
        self._pkt(from_client, "PA", data)
        if from_client:
            self.cseq += len(data)
        else:
            self.sseq += len(data)

    def client(self, payload: str):
        self._send(True, payload)

    def server(self, payload: str):
        self._send(False, payload)

    def ack(self, from_client: bool):
        """Pure acknowledgment of everything the other side sent so far."""
        self._pkt(from_client, "A")

    def close(self, server_first: bool = True):
        """Orderly FIN teardown: FIN/ACK, FIN/ACK, final ACK (each FIN consumes one seq)."""
        first = not server_first
        self._pkt(first, "FA")
        if first:
            self.cseq += 1
        else:
            self.sseq += 1
        self._pkt(not first, "FA")
        if not first:
            self.cseq += 1
        else:
            self.sseq += 1
        self._pkt(first, "A")


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


def follow_stream(packets, src_ip: str) -> bytes:
    """Reassemble one direction (packets sent by src_ip), ordered by sequence."""
    segments = []
    for pkt in packets:
        if IP in pkt and TCP in pkt and Raw in pkt and pkt[IP].src == src_ip:
            segments.append((pkt[TCP].seq, bytes(pkt[Raw].load)))
    segments.sort(key=lambda x: x[0])
    return b"".join(data for _, data in segments)


def write_capture(path: str, packets) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with PcapNgWriter(path) as writer:
        for pkt in packets:
            writer.write(pkt)


def verify_capture(path: str, flag: str, src_ip: str) -> int:
    """Read the file back; the flag must be recoverable from src_ip's reassembled stream."""
    back = rdpcap(path)
    if flag.encode() not in follow_stream(back, src_ip):
        raise SystemExit(f"[FAIL] {os.path.basename(path)}: flag not recoverable from the reassembled stream")
    return len(back)


def main(out_dir: str = OUT_DIR) -> int:
    env = load_flags_env()
    flag = env.get("FLAG_net1")
    if not flag:
        print("Missing from .flags.env: FLAG_net1", file=sys.stderr)
        return 1
    # net1: flag is in the client's PASS line (10.0.0.1 -> server).
    net1 = os.path.join(out_dir, "net1.pcapng")
    write_capture(net1, build_net1(flag))
    print(f"[OK] net1.pcapng: {verify_capture(net1, flag, '10.0.0.1')} packets, flag recoverable from the stream")
    print("Captures written to", out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
