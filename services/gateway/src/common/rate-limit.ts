import type { NextFunction, Request, Response } from 'express';

interface Window {
  startedAt: number;
  count: number;
}

/**
 * Fixed-window limiter per client IP, kept in memory (one gateway replica).
 * Used on `POST /api/orders` so the public demo cannot be flooded.
 */
export function rateLimit({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const windows = new Map<string, Window>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const time = now();
    let window = windows.get(key);
    if (!window || time - window.startedAt >= windowMs) {
      window = { startedAt: time, count: 0 };
      windows.set(key, window);
      if (windows.size > 10_000) windows.clear();
    }
    window.count += 1;

    const remaining = Math.max(0, limit - window.count);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    if (window.count > limit) {
      const retryAfter = Math.ceil((window.startedAt + windowMs - time) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        statusCode: 429,
        message: `Too many orders, try again in ${retryAfter}s`,
      });
      return;
    }
    next();
  };
}
