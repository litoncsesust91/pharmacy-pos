import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app.config.js';
import { HttpExceptionLoggingFilter } from './observability/http-exception.filter.js';
import { requestContext } from './observability/request-context.middleware.js';
import { RateLimitMiddleware } from './observability/rate-limit.middleware.js';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfig);

  const isProduction = process.env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...(process.env.WEB_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", ...(isProduction ? [] : ["'unsafe-eval'"])],
      },
    },
  }));
  const allowedOrigins = (process.env.WEB_ORIGINS ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use(requestContext);
  const rateLimit = new RateLimitMiddleware();
  app.use((request: Request, response: Response, next: NextFunction) => rateLimit.handle(request, response, next));
  app.useGlobalFilters(new HttpExceptionLoggingFilter());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pharmacy POS API')
    .setDescription('API foundation for the pharmacy POS SaaS platform')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.port);
}

void bootstrap();
