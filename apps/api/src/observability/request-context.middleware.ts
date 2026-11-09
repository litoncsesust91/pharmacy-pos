import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export function requestContext(request: Request & { requestId?: string }, response: Response, next: NextFunction): void {
  const requestId = request.header('x-request-id')?.slice(0, 80) || randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
