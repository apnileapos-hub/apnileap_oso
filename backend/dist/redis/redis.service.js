"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const redis_1 = require("redis");
let RedisService = class RedisService {
    async onModuleInit() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = (0, redis_1.createClient)({ url: redisUrl });
        this.client.on('error', (err) => console.error('Redis Client Error', err));
        try {
            await this.client.connect();
        }
        catch (err) {
            console.warn('Initial Redis connection failed, will retry on demand:', err.message);
        }
    }
    async onModuleDestroy() {
        if (this.client && this.client.isOpen) {
            await this.client.disconnect();
        }
    }
    async checkHealth() {
        try {
            if (!this.client.isOpen) {
                await this.client.connect();
            }
            const pong = await this.client.ping();
            return pong === 'PONG';
        }
        catch (error) {
            console.error('Redis health check failed:', error.message);
            return false;
        }
    }
    getClient() {
        return this.client;
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)()
], RedisService);
//# sourceMappingURL=redis.service.js.map