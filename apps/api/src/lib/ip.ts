/** Minimal IPv4 CIDR matching for the optional LAN subnet allowlist. */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255 || !/^\d+$/.test(p)) return null;
    n = (n << 8) | b;
  }
  return n >>> 0;
}

/** Strip an IPv6-mapped IPv4 prefix (::ffff:192.168.0.1 -> 192.168.0.1). */
export function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(normalizeIp(ip));
  const rangeInt = ipv4ToInt(range ?? '');
  if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

export function ipInAnyCidr(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c));
}
