import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './config';

describe('parseConfig', () => {
  it('runs in development with no env at all, using flagged dev secrets', () => {
    const config = parseConfig({});
    expect(config.env).toBe('development');
    expect(config.port).toBe(4000);
    expect(config.usingDevSecrets).toBe(true);
    expect(config.cookieSecure).toBe(false);
  });

  it('refuses to start in production without secrets', () => {
    expect(() => parseConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(() => parseConfig({ NODE_ENV: 'production', SESSION_SECRET: '' })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('keeps cookies non-secure on a plain-HTTP LAN deploy and secure behind HTTPS', () => {
    const prod = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), FLAG_PEPPER: 'y'.repeat(32) };
    // Plain-HTTP LAN: PUBLIC_URL is http (or unset) -> non-secure so cookies work.
    expect(parseConfig({ ...prod, PUBLIC_URL: 'http://192.168.1.50' }).cookieSecure).toBe(false);
    expect(parseConfig({ ...prod }).usingDevSecrets).toBe(false);
    // HTTPS public URL -> secure cookies.
    expect(parseConfig({ ...prod, PUBLIC_URL: 'https://ctf.example.com' }).cookieSecure).toBe(true);
    // Explicit override always wins.
    expect(parseConfig({ ...prod, COOKIE_SECURE: 'true' }).cookieSecure).toBe(true);
  });

  it('adds PUBLIC_URL to the allowed origins and parses subnets', () => {
    const config = parseConfig({ PUBLIC_URL: 'http://ctf.local/', ALLOWED_SUBNETS: '192.168.1.0/24, 10.0.0.0/8' });
    expect(config.publicUrl).toBe('http://ctf.local');
    expect(config.allowedOrigins).toContain('http://ctf.local');
    expect(config.allowedSubnets).toEqual(['192.168.1.0/24', '10.0.0.0/8']);
  });

  it('rejects short secrets and bad values', () => {
    expect(() => parseConfig({ SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => parseConfig({ TEAM_SCORING: 'anything' })).toThrow(/TEAM_SCORING/);
  });

  it('parses lists, booleans and event dates', () => {
    const config = parseConfig({
      ALLOWED_ORIGINS: 'https://a.example, https://b.example',
      DECAY_SCORING: 'true',
      EVENT_START: '2030-01-01T09:00:00Z',
      EVENT_END: '2030-01-01T17:00:00Z',
    });
    expect(config.allowedOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.scoring.decay.enabled).toBe(true);
    expect(config.event.startsAt?.toISOString()).toBe('2030-01-01T09:00:00.000Z');
  });

  it('rejects an event that ends before it starts', () => {
    expect(() =>
      parseConfig({ EVENT_START: '2030-01-02T00:00:00Z', EVENT_END: '2030-01-01T00:00:00Z' }),
    ).toThrow(/EVENT_END/);
  });

  it('defaults event mode to live in dev and scheduled in production', () => {
    expect(parseConfig({}).event.mode).toBe('live');
    const prod = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), FLAG_PEPPER: 'y'.repeat(32) };
    expect(parseConfig(prod).event.mode).toBe('scheduled');
  });

  it('refuses EVENT_MODE=live in production', () => {
    const prod = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), FLAG_PEPPER: 'y'.repeat(32) };
    expect(() => parseConfig({ ...prod, EVENT_MODE: 'live' })).toThrow(/EVENT_MODE=live is not allowed in production/);
    // but allowed in dev
    expect(parseConfig({ EVENT_MODE: 'live' }).event.mode).toBe('live');
  });
});
