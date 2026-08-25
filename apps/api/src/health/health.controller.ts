import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import Redis from 'ioredis';

@Controller('api/v1/health')
export class HealthController {
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      return { status: 'ready' };
    } catch (e) {
      throw new ServiceUnavailableException({ status: 'not_ready', detail: String(e) });
    }
  }
}
