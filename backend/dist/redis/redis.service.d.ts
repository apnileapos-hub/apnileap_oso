import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisClientType } from 'redis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private client;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    checkHealth(): Promise<boolean>;
    getClient(): RedisClientType;
}
