import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { testApp } from './test-utils';

const { app } = testApp();

describe('GET /healthz', () => {
  it('reports ok with a database check and is not cached', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('allows the configured origin with credentials', async () => {
    const res = await request(app).get('/healthz').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow unknown origins', async () => {
    const res = await request(app).get('/healthz').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('errors', () => {
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON without leaking parser details', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Malformed request');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });
});
