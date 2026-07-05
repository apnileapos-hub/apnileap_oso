import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { BookstackService } from '../bookstack/bookstack.service';
import { KeycloakService } from '../keycloak/keycloak.service';
import { MinioService } from '../minio/minio.service';
import { N8nService } from '../n8n/n8n.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitmq: RabbitmqService,
    private readonly gitlab: GitlabService,
    private readonly bookstack: BookstackService,
    private readonly keycloak: KeycloakService,
    private readonly minio: MinioService,
    private readonly n8n: N8nService,
  ) {}

  @Get()
  async getHealth() {
    const dbStatus = await this.prisma.checkHealth();
    const redisStatus = await this.redis.checkHealth();
    const rabbitmqStatus = await this.rabbitmq.checkHealth();
    const gitlabStatus = await this.gitlab.checkHealth();
    const bookstackStatus = await this.bookstack.checkHealth();
    const keycloakStatus = await this.keycloak.checkHealth();
    const minioStatus = await this.minio.checkHealth();
    const n8nStatus = await this.n8n.checkHealth();

    const isHealthy =
      dbStatus &&
      redisStatus &&
      rabbitmqStatus &&
      gitlabStatus &&
      bookstackStatus &&
      keycloakStatus &&
      minioStatus &&
      n8nStatus;

    return {
      status: isHealthy ? 'ok' : 'error',
      details: {
        database: { status: dbStatus ? 'up' : 'down' },
        redis: { status: redisStatus ? 'up' : 'down' },
        rabbitmq: { status: rabbitmqStatus ? 'up' : 'down' },
        gitlab: { status: gitlabStatus ? 'up' : 'down' },
        bookstack: { status: bookstackStatus ? 'up' : 'down' },
        keycloak: { status: keycloakStatus ? 'up' : 'down' },
        minio: { status: minioStatus ? 'up' : 'down' },
        n8n: { status: n8nStatus ? 'up' : 'down' },
      },
    };
  }
}
