"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const rabbitmq_service_1 = require("../rabbitmq/rabbitmq.service");
const gitlab_service_1 = require("../gitlab/gitlab.service");
const bookstack_service_1 = require("../bookstack/bookstack.service");
const keycloak_service_1 = require("../keycloak/keycloak.service");
const minio_service_1 = require("../minio/minio.service");
const n8n_service_1 = require("../n8n/n8n.service");
let HealthController = class HealthController {
    constructor(prisma, redis, rabbitmq, gitlab, bookstack, keycloak, minio, n8n) {
        this.prisma = prisma;
        this.redis = redis;
        this.rabbitmq = rabbitmq;
        this.gitlab = gitlab;
        this.bookstack = bookstack;
        this.keycloak = keycloak;
        this.minio = minio;
        this.n8n = n8n;
    }
    async getHealth() {
        const dbStatus = await this.prisma.checkHealth();
        const redisStatus = await this.redis.checkHealth();
        const rabbitmqStatus = await this.rabbitmq.checkHealth();
        const gitlabStatus = await this.gitlab.checkHealth();
        const bookstackStatus = await this.bookstack.checkHealth();
        const keycloakStatus = await this.keycloak.checkHealth();
        const minioStatus = await this.minio.checkHealth();
        const n8nStatus = await this.n8n.checkHealth();
        const isHealthy = dbStatus &&
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
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getHealth", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        rabbitmq_service_1.RabbitmqService,
        gitlab_service_1.GitlabService,
        bookstack_service_1.BookstackService,
        keycloak_service_1.KeycloakService,
        minio_service_1.MinioService,
        n8n_service_1.N8nService])
], HealthController);
//# sourceMappingURL=health.controller.js.map