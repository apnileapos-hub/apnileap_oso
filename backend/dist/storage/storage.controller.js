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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const minio_service_1 = require("../minio/minio.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
let StorageController = class StorageController {
    constructor(minioService) {
        this.minioService = minioService;
    }
    async uploadFile(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file provided for upload');
        }
        const bucketName = 'apnileap-deliverables';
        const objectName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        try {
            const url = await this.minioService.uploadFile(bucketName, objectName, file.buffer, file.size, file.mimetype);
            return {
                success: true,
                fileName: file.originalname,
                objectName,
                url,
            };
        }
        catch (err) {
            console.error('[Storage Upload Error] Failed to upload to MinIO:', err.message);
            throw new common_1.BadRequestException('Storage server upload failed');
        }
    }
    async getPresignedUrl(fileName, bucket = 'apnileap-deliverables') {
        if (!fileName) {
            throw new common_1.BadRequestException('fileName query parameter is required');
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
};
exports.StorageController = StorageController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Get)('presigned-url'),
    __param(0, (0, common_1.Query)('fileName')),
    __param(1, (0, common_1.Query)('bucket')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getPresignedUrl", null);
exports.StorageController = StorageController = __decorate([
    (0, common_1.Controller)('api/storage'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [minio_service_1.MinioService])
], StorageController);
//# sourceMappingURL=storage.controller.js.map