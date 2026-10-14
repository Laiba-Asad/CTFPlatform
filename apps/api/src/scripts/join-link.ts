/**
 * npm run join-link
 *
 * Prints the address players use to reach the platform, plus a QR code they can
 * scan from a phone on the same network. Uses PUBLIC_URL when set; otherwise it
 * guesses from the machine's first non-internal IPv4 address and the web port.
 */
import { networkInterfaces } from 'node:os';
import qrcode from 'qrcode-terminal';
import { loadConfig } from '../config';
import { runScript } from './cli';

function guessLanUrl(): string {
  const port = process.env.WEB_PORT || '5173';
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return `http://${addr.address}:${port}`;
    }
  }
  return `http://localhost:${port}`;
}

runScript(async () => {
  const config = loadConfig();
  const url = config.publicUrl || guessLanUrl();

  console.log('\n  Cydemic CTF // ARENA - join link\n');
  console.log(`  ${url}\n`);
  if (!config.publicUrl) {
    console.log('  (guessed from this machine\'s LAN address; set PUBLIC_URL to pin it)\n');
  }
  qrcode.generate(url, { small: true }, (qr) => console.log(qr));
  console.log('  Scan with a phone on the same network, or share the link.\n');
});
