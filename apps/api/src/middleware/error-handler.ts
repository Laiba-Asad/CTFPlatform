import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError, notFound } from '../lib/http-error';

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound());

/**
 * Converts every error to a JSON body `{ error: { code, message, details? } }`.
 * Stack traces and internal messages never reach the client.
 */
export function errorHandler(isProd: boolean): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      const retry = err.details?.retryAfterSeconds;
      if (typeof retry === 'number') res.set('Retry-After', String(retry));
      res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
      });
      return;
    }

    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields are invalid',
          details: {
            fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
        },
      });
      return;
    }

    // Errors raised by body-parser and similar middleware carry a client status.
    const status = typeof err?.status === 'number' ? err.status : 500;
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'Malformed request' } });
      return;
    }

    req.log?.error({ err }, 'unhandled error');
    res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: isProd ? 'Something went wrong' : `Internal error: ${String(err?.message ?? err)}`,
      },
    });
  };
}
