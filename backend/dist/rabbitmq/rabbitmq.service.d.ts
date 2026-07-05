import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class RabbitmqService implements OnModuleInit, OnModuleDestroy {
    private connection;
    private channel;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    checkHealth(): Promise<boolean>;
    getChannel(): any;
}
