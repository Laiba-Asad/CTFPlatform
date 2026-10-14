import type { Request } from 'express';

/**
 * Read a route parameter as a plain string. Express 5's handler overloads widen
 * `req.params[x]` to `string | string[] | undefined` when a route also has
 * middleware (e.g. requireAdminRole); this narrows it back for lookups.
 */
export function reqParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
