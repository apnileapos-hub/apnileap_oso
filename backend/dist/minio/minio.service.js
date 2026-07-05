"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinioService = void 0;
const common_1 = require("@nestjs/common");
const Minio = require("minio");
let MinioService = class MinioService {
    onModuleInit() {
        this.minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        });
    }
    async checkHealth() {
        try {
            await this.minioClient.listBuckets();
            return true;
        }
        catch (error) {
            console.error('MinIO health check failed:', error.message);
            return false;
        }
    }
    getClient() {
        return this.minioClient;
    }
    async createBucket(bucketName) {
        try {
            const bucketExists = await this.minioClient.bucketExists(bucketName);
            if (!bucketExists) {
                await this.minioClient.makeBucket(bucketName, 'us-east-1');
                console.log(`[MinIO] Successfully created bucket: "${bucketName}"`);
            }
        }
        catch (err) {
            console.warn(`[MinIO] Bucket check/creation failed for "${bucketName}":`, err.message);
        }
    }
    async uploadFile(bucketName, objectName, buffer, size, mimeType) {
        await this.createBucket(bucketName);
        await this.minioClient.putObject(bucketName, objectName, buffer, size, {
            'Content-Type': mimeType,
        });
        return this.getPresignedGetUrl(bucketName, objectName);
    }
    async getPresignedGetUrl(bucketName, objectName, expires = 86400) {
        try {
            return await this.minioClient.presignedGetObject(bucketName, objectName, expires);
        }
        catch (err) {
            console.error('[MinIO] Presigned GET URL failed:', err.message);
            const host = process.env.MINIO_ENDPOINT || 'localhost';
            const port = process.env.MINIO_PORT || '9000';
            return `http://${host}:${port}/${bucketName}/${objectName}`;
        }
    }
    async getPresignedPutUrl(bucketName, objectName, expires = 3600) {
        await this.createBucket(bucketName);
        try {
            return await this.minioClient.presignedPutObject(bucketName, objectName, expires);
        }
        catch (err) {
            console.error('[MinIO] Presigned PUT URL failed:', err.message);
            const host = process.env.MINIO_ENDPOINT || 'localhost';
            const port = process.env.MINIO_PORT || '9000';
            return `http://${host}:${port}/${bucketName}/${objectName}`;
        }
    }
};
exports.MinioService = MinioService;
exports.MinioService = MinioService = __decorate([
    (0, common_1.Injectable)()
], MinioService);
//# sourceMappingURL=minio.service.js.map