import { HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitMiddleware } from './rate-limit.middleware.js';

describe('RateLimitMiddleware', () => {
  it('limits authentication requests more strictly than normal API requests', () => {
    const middleware = new RateLimitMiddleware();
    const next = jest.fn();
    const request = { ip: '127.0.0.1', path: '/api/auth/login' } as Request;
    for (let attempt = 0; attempt < 10; attempt += 1) middleware.handle(request, {} as never, next);
    expect(() => middleware.handle(request, {} as never, next)).toThrow(HttpException);
    expect(next).toHaveBeenCalledTimes(10);
  });
});
