import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns the API health status', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'pharmacy-pos-api',
    });
  });

  it('reports degraded readiness when no database provider is configured', async () => {
    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'degraded',
      service: 'pharmacy-pos-api',
      database: 'unavailable',
    });
  });
});
