import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { WikiService } from '../wiki/wiki.service';
import { KeycloakService } from '../keycloak/keycloak.service';
import { MinioService } from '../minio/minio.service';
import { N8nService } from '../n8n/n8n.service';
export declare class HealthController {
    private readonly prisma;
    private readonly redis;
    private readonly rabbitmq;
    private readonly gitlab;
    private readonly wiki;
    private readonly keycloak;
    private readonly minio;
    private readonly n8n;
    constructor(prisma: PrismaService, redis: RedisService, rabbitmq: RabbitmqService, gitlab: GitlabService, wiki: WikiService, keycloak: KeycloakService, minio: MinioService, n8n: N8nService);
    getHealth(): Promise<{
        status: string;
        details: {
            database: {
                status: string;
            };
            redis: {
                status: string;
            };
            rabbitmq: {
                status: string;
            };
            gitlab: {
                status: string;
            };
            wiki: {
                status: string;
            };
            keycloak: {
                status: string;
            };
            minio: {
                status: string;
            };
            n8n: {
                status: string;
            };
        };
    }>;
}
