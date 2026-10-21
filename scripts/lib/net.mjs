// Shared helpers for the production scripts: LAN IP detection and port checks.
import { createConnection, createServer } from 'node:net';
import { networkInterfaces } from 'node:os';

/** The VM's primary LAN IPv4 (non-internal). Falls back to 127.0.0.1. */
export function detectLanIp() {
  const nets = networkInterfaces();
  const candidates = [];
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push(a.address);
    }
  }
  // Prefer common private ranges, in a stable order.
  const score = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3);
  candidates.sort((a, b) => score(a) - score(b));
  return candidates[0] ?? '127.0.0.1';
}

/** True if something is already listening on the TCP port (host 0.0.0.0 view). */
export function portInUse(port, host = '127.0.0.1') {
  return new Promise((res) => {
    const socket = createConnection({ port, host });
    socket.setTimeout(500);
    socket.on('connect', () => (socket.destroy(), res(true)));
    socket.on('timeout', () => (socket.destroy(), res(false)));
    socket.on('error', () => res(false));
  });
}

/** True if we can bind the port on 0.0.0.0 (i.e. it is free to use). */
export function portBindable(port) {
  return new Promise((res) => {
    const srv = createServer();
    srv.once('error', () => res(false));
    srv.once('listening', () => srv.close(() => res(true)));
    srv.listen(port, '0.0.0.0');
  });
}
