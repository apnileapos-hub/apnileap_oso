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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
let UsersController = class UsersController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyself() {
        return {
            accountId: 'admin-mock-id',
            displayName: 'apnileapos (Offline)',
            emailAddress: 'apnileapos@gmail.com',
            avatarUrls: {
                '48x48': 'https://i.pravatar.cc/150?img=68',
            },
            active: true,
            timeZone: 'Asia/Kolkata',
        };
    }
    async getUsers(page = '1', limit = '10', search = '', role, collegeId) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (role) {
            where.role = role;
        }
        if (collegeId) {
            where.collegeId = collegeId;
        }
        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { name: 'asc' },
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            items,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }
    async getSpokeMembers(boardId) {
        const spokeKey = boardId === '3' ? 'kle-spoke' : (boardId === '101' ? 'coep-spoke' : (boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));
        const members = await this.prisma.user.findMany({
            where: { collegeId: spokeKey },
            select: {
                email: true,
                name: true,
                role: true,
            },
        });
        return members.map(m => ({
            accountId: m.email,
            displayName: m.name,
            emailAddress: m.email,
            role: m.role,
        }));
    }
    async getCampusStudents(campusId) {
        const spokeKey = campusId === '3' ? 'kle-spoke' : (campusId === '101' ? 'coep-spoke' : (campusId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));
        return this.prisma.user.findMany({
            where: {
                collegeId: spokeKey,
                role: 'Student',
            },
            select: {
                id: true,
                name: true,
                email: true,
            },
        });
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('myself'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMyself", null);
__decorate([
    (0, common_1.Get)('api/users'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('role')),
    __param(4, (0, common_1.Query)('collegeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Get)('spokes/:boardId/members'),
    __param(0, (0, common_1.Param)('boardId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getSpokeMembers", null);
__decorate([
    (0, common_1.Get)('students/:campusId'),
    __param(0, (0, common_1.Param)('campusId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getCampusStudents", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersController);
//# sourceMappingURL=users.controller.js.map