import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: any;

  async onModuleInit() {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    try {
      this.connection = await amqp.connect(rabbitUrl);
      this.channel = await this.connection.createChannel();
    } catch (err) {
      console.warn('Initial RabbitMQ connection failed, will retry on demand:', err.message);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (err) {
      console.error('Failed to close RabbitMQ connection gracefully:', err.message);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      if (!this.connection) {
        const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        this.connection = await amqp.connect(rabbitUrl);
        this.channel = await this.connection.createChannel();
      }
      return true;
    } catch (error) {
      console.error('RabbitMQ health check failed:', error.message);
      return false;
    }
  }

  getChannel(): any {
    return this.channel;
  }
}
