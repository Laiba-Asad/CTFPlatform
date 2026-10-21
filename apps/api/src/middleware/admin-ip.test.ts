import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminIpAllowed } from './admin-auth';
import { createApp } from '../app';
import { resetDb, testConfig, testDb } from '../test-utils';

const db = testDb();
beforeEach(() => resetDb(db));

describe('adminIpAllowed', () => {
  it('always allows localhost, plus the configured exact IPs', () => {
    const config = testConfig({ ADMIN_ALLOWED_IPS: '192.168.1.50' });
    expect(adminIpAllowed(config, '127.0.0.1')).toBe(true);
    expect(adminIpAllowed(config, '::1')).toBe(true);
    expect(adminIpAllowed(config, '192.168.1.50')).toBe(true);
    expect(adminIpAllowed(config, '::ffff:192.168.1.50')).toBe(true); // IPv4-mapped
    expect(adminIpAllowed(config, '192.168.1.51')).toBe(false);
    expect(adminIpAllowed(config, '10.0.0.9')).toBe(false);
  });

  it('still honours a CIDR allowlist when given', () => {
    const config = testConfig({ ADMIN_ALLOWED_SUBNETS: '10.0.0.0/8' });
    expect(adminIpAllowed(config, '10.4.5.6')).toBe(true);
    expect(adminIpAllowed(config, '192.168.1.1')).toBe(false);
  });
});

describe('admin API IP restriction', () => {
  const prod = (ips: string) =>
    createApp(testConfig({ NODE_ENV: 'production', TRUST_PROXY: '1', ADMIN_ALLOWED_IPS: ips, SESSION_SECRET: 'x'.repeat(40), FLAG_PEPPER: 'y'.repeat(40) }), { db });

  it('returns 404 (not 403) to a non-allowed address in production', async () => {
    const app = prod('192.168.1.50');
    const res = await request(app).get('/api/admin/auth/session').set('X-Forwarded-For', '10.9.9.9');
    expect(res.status).toBe(404);
  });

  it('lets an allowed address reach the admin API (401 without a session, not 404)', async () => {
    const app = prod('192.168.1.50');
    const res = await request(app).get('/api/admin/overview').set('X-Forwarded-For', '192.168.1.50');
    expect(res.status).toBe(401);
    const local = await request(app).get('/api/admin/overview');
    expect(local.status).toBe(401);
  });
});
