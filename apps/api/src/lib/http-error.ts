/** An error whose message is safe to show to the client. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const unauthorized = (message = 'Sign in required') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Not allowed') => new HttpError(403, 'FORBIDDEN', message);
