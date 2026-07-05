import { Controller, Post, Get, UseInterceptors, UploadedFile, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioService } from '../minio/minio.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('api/storage')
@UseGuards(AuthGuard)
export class StorageController {
  constructor(private readonly minioService: MinioService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const bucketName = 'apnileap-deliverables';
    const objectName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    try {
      const url = await this.minioService.uploadFile(
        bucketName,
        objectName,
        file.buffer,
        file.size,
        file.mimetype,
      );

      return {
        success: true,
        fileName: file.originalname,
        objectName,
        url,
      };
    } catch (err) {
      console.error('[Storage Upload Error] Failed to upload to MinIO:', err.message);
      throw new BadRequestException('Storage server upload failed');
    }
  }

  @Get('presigned-url')
  async getPresignedUrl(
    @Query('fileName') fileName: string,
    @Query('bucket') bucket: string = 'apnileap-deliverables',
  ) {
    if (!fileName) {
      throw new BadRequestException('fileName query parameter is required');
    }

    const objectName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const uploadUrl = await this.minioService.getPresignedPutUrl(bucket, objectName);
    const downloadUrl = await this.minioService.getPresignedGetUrl(bucket, objectName);

    return {
      success: true,
      uploadUrl,
      downloadUrl,
      objectName,
    };
  }
}
