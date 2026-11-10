import { Catch, type ArgumentsHost, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId?: string }>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const message = typeof exceptionResponse === 'string' ? exceptionResponse : (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse ? exceptionResponse.message : 'Request failed');
    this.logger.error(JSON.stringify({ requestId: request.requestId, method: request.method, path: request.path, status, error: exception instanceof Error ? exception.name : 'UnknownError' }));
    response.status(status).json({ statusCode: status, message, requestId: request.requestId });
  }
}
