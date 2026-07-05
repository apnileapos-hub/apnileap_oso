import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => console.error('Redis Client Error', err));
    try {
      await this.client.connect();
    } catch (err) {
      console.warn('Initial Redis connection failed, will retry on demand:', err.message);
    }
  }

  async onModuleDestroy() {
    if (this.client && this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error.message);
      return false;
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }
}
