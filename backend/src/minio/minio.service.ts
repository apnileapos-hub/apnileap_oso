import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private minioClient: Minio.Client;

  onModuleInit() {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.minioClient.listBuckets();
      return true;
    } catch (error) {
      console.error('MinIO health check failed:', error.message);
      return false;
    }
  }

  getClient(): Minio.Client {
    return this.minioClient;
  }

  async createBucket(bucketName: string): Promise<void> {
    try {
      const bucketExists = await this.minioClient.bucketExists(bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(bucketName, 'us-east-1');
        console.log(`[MinIO] Successfully created bucket: "${bucketName}"`);
      }
    } catch (err) {
      console.warn(`[MinIO] Bucket check/creation failed for "${bucketName}":`, err.message);
    }
  }

  async uploadFile(bucketName: string, objectName: string, buffer: Buffer, size: number, mimeType: string): Promise<string> {
    await this.createBucket(bucketName);
    
    await this.minioClient.putObject(bucketName, objectName, buffer, size, {
      'Content-Type': mimeType,
    });

    return this.getPresignedGetUrl(bucketName, objectName);
  }

  async getPresignedGetUrl(bucketName: string, objectName: string, expires: number = 86400): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(bucketName, objectName, expires);
    } catch (err) {
      console.error('[MinIO] Presigned GET URL failed:', err.message);
      const host = process.env.MINIO_ENDPOINT || 'localhost';
      const port = process.env.MINIO_PORT || '9000';
      return `http://${host}:${port}/${bucketName}/${objectName}`;
    }
  }

  async getPresignedPutUrl(bucketName: string, objectName: string, expires: number = 3600): Promise<string> {
    await this.createBucket(bucketName);
    try {
      return await this.minioClient.presignedPutObject(bucketName, objectName, expires);
    } catch (err) {
      console.error('[MinIO] Presigned PUT URL failed:', err.message);
      const host = process.env.MINIO_ENDPOINT || 'localhost';
      const port = process.env.MINIO_PORT || '9000';
      return `http://${host}:${port}/${bucketName}/${objectName}`;
    }
  }
}
