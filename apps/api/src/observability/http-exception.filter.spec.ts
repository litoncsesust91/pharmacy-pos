import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { HttpExceptionLoggingFilter } from './http-exception.filter.js';

describe('HttpExceptionLoggingFilter', () => {
  it('returns a JSON error instead of delegating to an unconfigured adapter', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const filter = new HttpExceptionLoggingFilter();
    filter.catch(new BadRequestException('Invalid product'), {
      switchToHttp: () => ({ getRequest: () => ({ requestId: 'request-1', method: 'POST', path: '/api/catalog/products' }), getResponse: () => ({ status, json }) as unknown as Response }),
    } as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Invalid product', requestId: 'request-1' }));
  });
});
