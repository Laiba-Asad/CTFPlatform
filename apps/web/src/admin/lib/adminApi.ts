import type { ApiErrorBody } from '@cydemic/shared';
import { ApiError } from '../../lib/api';

/** Admin CSRF token (separate cookie from the player site). Memory only. */
let adminCsrf: string | null = null;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/** Fetch wrapper for the admin API. Prefixes /api/admin and carries admin CSRF. */
export async function adminApi<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    if (!adminCsrf) await adminApi('/auth/session');
    headers['X-CSRF-Token'] = adminCsrf ?? '';
  }

  const res = await fetch(`/api/admin${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);

  if (data && typeof data === 'object' && 'csrfToken' in data && typeof data.csrfToken === 'string') {
    adminCsrf = data.csrfToken;
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? 'Something went wrong. Try again.', err?.details);
  }
  return data as T;
}

/** Open an admin CSV/JSON export in a new tab (GET, same-origin cookie auth). */
export function adminDownload(path: string): void {
  window.open(`/api/admin${path}`, '_blank', 'noopener');
}
