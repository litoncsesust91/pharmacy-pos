import { HttpException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

export class RateLimitMiddleware {
  private readonly buckets = new Map<string, Bucket>();

  handle(request: Request, _response: Response, next: NextFunction): void {
    const now = Date.now();
    const limit = request.path.startsWith('/api/auth') ? 10 : 120;
    const key = `${request.ip ?? 'unknown'}:${request.path.startsWith('/api/auth') ? 'auth' : 'api'}`;
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + 60_000 });
      next();
      return;
    }
    if (bucket.count >= limit) throw new HttpException('Rate limit exceeded', 429);
    bucket.count += 1;
    next();
  }
}
