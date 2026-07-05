"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitmqService = void 0;
const common_1 = require("@nestjs/common");
const amqp = require("amqplib");
let RabbitmqService = class RabbitmqService {
    async onModuleInit() {
        const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        try {
            this.connection = await amqp.connect(rabbitUrl);
            this.channel = await this.connection.createChannel();
        }
        catch (err) {
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
        }
        catch (err) {
            console.error('Failed to close RabbitMQ connection gracefully:', err.message);
        }
    }
    async checkHealth() {
        try {
            if (!this.connection) {
                const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
                this.connection = await amqp.connect(rabbitUrl);
                this.channel = await this.connection.createChannel();
            }
            return true;
        }
        catch (error) {
            console.error('RabbitMQ health check failed:', error.message);
            return false;
        }
    }
    getChannel() {
        return this.channel;
    }
};
exports.RabbitmqService = RabbitmqService;
exports.RabbitmqService = RabbitmqService = __decorate([
    (0, common_1.Injectable)()
], RabbitmqService);
//# sourceMappingURL=rabbitmq.service.js.map