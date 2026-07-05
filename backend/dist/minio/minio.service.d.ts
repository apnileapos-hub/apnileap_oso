import { OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
export declare class MinioService implements OnModuleInit {
    private minioClient;
    onModuleInit(): void;
    checkHealth(): Promise<boolean>;
    getClient(): Minio.Client;
    createBucket(bucketName: string): Promise<void>;
    uploadFile(bucketName: string, objectName: string, buffer: Buffer, size: number, mimeType: string): Promise<string>;
    getPresignedGetUrl(bucketName: string, objectName: string, expires?: number): Promise<string>;
    getPresignedPutUrl(bucketName: string, objectName: string, expires?: number): Promise<string>;
}
