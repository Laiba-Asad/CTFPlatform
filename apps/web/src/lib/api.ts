import type { ApiErrorBody } from '@cydemic/shared';

/** CSRF token from the last session/login/logout response. Kept in memory only. */
let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorBody['error']['details'] = {},
  ) {
    super(message);
  }

  get retryAfterSeconds(): number | null {
    return typeof this.details?.retryAfterSeconds === 'number' ? this.details.retryAfterSeconds : null;
  }

  fieldError(field: string): string | null {
    const fields = this.details?.fields;
    if (!Array.isArray(fields)) return null;
    const match = fields.find((f: { path?: string }) => f?.path === field) as { message?: string } | undefined;
    return match?.message ?? null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    if (!csrfToken) await api('/auth/session');
    headers['X-CSRF-Token'] = csrfToken ?? '';
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);

  if (data && typeof data === 'object' && 'csrfToken' in data && typeof data.csrfToken === 'string') {
    csrfToken = data.csrfToken;
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? 'Something went wrong. Try again.', err?.details);
  }
  return data as T;
}
