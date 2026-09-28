import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/**
 * Gives every request an `x-request-id` (or keeps the caller's), forwards it downstream
 * through the proxy and logs one access line per request.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming)
      ? incoming
      : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);

  const started = performance.now();
  res.on('finish', () => {
    const ms = Math.round(performance.now() - started);
    logger.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms [${id}]`,
    );
  });
  next();
}
