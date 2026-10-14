import type { CookieOptions } from 'express';
import type { AppConfig } from '../config';

/**
 * With secure cookies (HTTPS) we use the __Host- prefix: the browser then
 * guarantees Secure, Path=/ and no Domain, so subdomains cannot plant cookies.
 */
export function cookieNames(config: AppConfig) {
  const prefix = config.cookieSecure ? '__Host-' : '';
  return {
    session: `${prefix}cydemic_ctf_sid`,
    csrf: `${prefix}cydemic_csrf`,
    // The admin area has its own, separate session cookie.
    adminSession: `${prefix}cydemic_ctf_admin_sid`,
    adminCsrf: `${prefix}cydemic_admin_csrf`,
  };
}

export function sessionCookieOptions(config: AppConfig): CookieOptions {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/', maxAge: config.sessionTtlMs };
}

export function adminSessionCookieOptions(config: AppConfig): CookieOptions {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/', maxAge: config.admin.maxSessionMs };
}

export function csrfCookieOptions(config: AppConfig): CookieOptions {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' };
}
