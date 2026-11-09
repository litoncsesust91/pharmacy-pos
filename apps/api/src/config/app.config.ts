import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
}

export const appConfig = (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
});

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<AppConfiguration, true>) {}

  get nodeEnv(): string {
    return this.config.get('nodeEnv', { infer: true });
  }

  get port(): number {
    return this.config.get('port', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('databaseUrl', { infer: true });
  }

  get redisUrl(): string {
    return this.config.get('redisUrl', { infer: true });
  }
}
