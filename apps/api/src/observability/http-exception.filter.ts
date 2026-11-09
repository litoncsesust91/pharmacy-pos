import { Catch, type ArgumentsHost, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionLoggingFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('HTTP');

  override catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId?: string }>();
    const response = context.getResponse<Response>();
    this.logger.error(JSON.stringify({ requestId: request.requestId, method: request.method, path: request.path, status: response.statusCode, error: exception instanceof Error ? exception.name : 'UnknownError' }));
    super.catch(exception, host);
  }
}
