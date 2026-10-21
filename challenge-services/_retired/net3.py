"""net3 - Banner Grab. A plain TCP service (not HTTP) that greets every client.

Intended trail: scan ports 5000-5100 of the event server with nmap, spot the
service that does not speak HTTP, connect with ncat (or `nmap --script banner`).
The banner, sent as soon as a client connects, contains the flag; the
connection then closes after a short timeout.

waitress does not apply here: this is a small threaded socket server. It caps
concurrent connections (extra clients are closed without a banner), never reads
more than a little input, and never logs anything (so never the flag).
"""
import socketserver
import threading

from common import ChallengeConfig

RAW_TCP = True  # serve.py runs create_app(config).serve_forever() instead of waitress
BANNER_TIMEOUT_SECONDS = 2.0

BANNER = (
    "NIGHTOWL maintenance console v0.9 (build 1142)\r\n"
    "Welcome, operator. Access code: {flag}\r\n"
    "Session closing.\r\n"
)


class _Handler(socketserver.BaseRequestHandler):
    def handle(self):
        server: "BannerServer" = self.server  # type: ignore[assignment]
        if not server.slots.acquire(blocking=False):
            return  # over the cap: close without a banner
        try:
            self.request.settimeout(BANNER_TIMEOUT_SECONDS)
            self.request.sendall(server.banner)
            try:
                self.request.recv(256)  # any input, or the timeout, ends the session
            except OSError:
                pass
        finally:
            server.slots.release()


class BannerServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    # Never share the port with another process (SO_REUSEADDR on Windows would allow it).
    allow_reuse_address = False

    def __init__(self, address, banner: bytes, max_connections: int):
        self.banner = banner
        self.slots = threading.BoundedSemaphore(max_connections)
        super().__init__(address, _Handler)

    def handle_error(self, request, client_address):
        pass  # a dropped client is normal; never print tracebacks (or anything else)

    @property
    def effective_port(self) -> int:
        return self.server_address[1]


def create_app(config: ChallengeConfig, host: str = "0.0.0.0") -> BannerServer:
    banner = BANNER.format(flag=config.flag).encode()
    return BannerServer((host, config.port), banner, max(4, config.max_concurrency * 2))
