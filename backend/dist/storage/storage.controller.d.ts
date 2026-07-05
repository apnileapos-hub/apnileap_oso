import { MinioService } from '../minio/minio.service';
export declare class StorageController {
    private readonly minioService;
    constructor(minioService: MinioService);
    uploadFile(file: any): Promise<{
        success: boolean;
        fileName: any;
        objectName: string;
        url: string;
    }>;
    getPresignedUrl(fileName: string, bucket?: string): Promise<{
        success: boolean;
        uploadUrl: string;
        downloadUrl: string;
        objectName: string;
    }>;
}
