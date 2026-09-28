import type { Request, Response } from 'express';
import { rateLimit } from './rate-limit.js';

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    },
  };
  return res;
}

describe('rateLimit', () => {
  it('allows up to the limit per window, then answers 429 with Retry-After', () => {
    let time = 0;
    const limiter = rateLimit({ limit: 2, windowMs: 60_000, now: () => time });
    const req = { ip: '1.2.3.4' } as Request;
    const next = vi.fn();

    limiter(req, fakeRes() as unknown as Response, next);
    limiter(req, fakeRes() as unknown as Response, next);
    const blocked = fakeRes();
    time = 15_000;
    limiter(req, blocked as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBe('45');

    time = 60_000;
    limiter(req, fakeRes() as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('tracks clients separately', () => {
    const limiter = rateLimit({ limit: 1, windowMs: 60_000 });
    const next = vi.fn();
    limiter({ ip: 'a' } as Request, fakeRes() as unknown as Response, next);
    limiter({ ip: 'b' } as Request, fakeRes() as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
