import type { Request, Response } from 'express';
import { requestContext } from './request-context.middleware.js';

describe('requestContext', () => {
  it('propagates a bounded request id', () => {
    const request = { header: jest.fn().mockReturnValue('client-request-id') } as unknown as Request & { requestId?: string };
    const setHeader = jest.fn();
    const next = jest.fn();
    requestContext(request, { setHeader } as unknown as Response, next);
    expect(request.requestId).toBe('client-request-id');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'client-request-id');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
