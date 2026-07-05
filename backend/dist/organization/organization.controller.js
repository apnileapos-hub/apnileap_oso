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
exports.OrganizationController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
let OrganizationController = class OrganizationController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOrganizations(page = '1', limit = '10', search = '') {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { domain: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await Promise.all([
            this.prisma.organization.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { name: 'asc' },
            }),
            this.prisma.organization.count({ where }),
        ]);
        return {
            items,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }
    async createOrganization(body) {
        return this.prisma.organization.create({
            data: {
                name: body.name,
                domain: body.domain,
            },
        });
    }
    async updateOrganization(id, body) {
        return this.prisma.organization.update({
            where: { id },
            data: body,
        });
    }
    async deleteOrganization(id) {
        await this.prisma.organization.delete({ where: { id } });
        return { success: true };
    }
    async getCompanies(page = '1', limit = '10', search = '', orgId) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        if (orgId) {
            where.organizationId = parseInt(orgId) || undefined;
        }
        const [items, total] = await Promise.all([
            this.prisma.company.findMany({
                where,
                skip,
                take: limitNum,
                include: { organization: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.company.count({ where }),
        ]);
        return {
            items,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }
    async createCompany(body) {
        return this.prisma.company.create({
            data: {
                name: body.name,
                logoUrl: body.logoUrl,
                organizationId: body.organizationId,
            },
        });
    }
    async updateCompany(id, body) {
        return this.prisma.company.update({
            where: { id },
            data: body,
        });
    }
    async deleteCompany(id) {
        await this.prisma.company.delete({ where: { id } });
        return { success: true };
    }
    async getColleges(page = '1', limit = '10', search = '', orgId) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        if (orgId) {
            where.organizationId = parseInt(orgId) || undefined;
        }
        const [items, total] = await Promise.all([
            this.prisma.college.findMany({
                where,
                skip,
                take: limitNum,
                include: { organization: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.college.count({ where }),
        ]);
        return {
            items,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }
    async createCollege(body) {
        return this.prisma.college.create({
            data: {
                name: body.name,
                universityId: body.universityId,
                organizationId: body.organizationId,
            },
        });
    }
    async updateCollege(id, body) {
        return this.prisma.college.update({
            where: { id },
            data: body,
        });
    }
    async deleteCollege(id) {
        await this.prisma.college.delete({ where: { id } });
        return { success: true };
    }
    async getDepartments(page = '1', limit = '10', search = '', collegeId, companyId) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        if (collegeId) {
            where.collegeId = parseInt(collegeId) || undefined;
        }
        if (companyId) {
            where.companyId = parseInt(companyId) || undefined;
        }
        const [items, total] = await Promise.all([
            this.prisma.department.findMany({
                where,
                skip,
                take: limitNum,
                include: { college: true, company: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.department.count({ where }),
        ]);
        return {
            items,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }
    async createDepartment(body) {
        return this.prisma.department.create({
            data: {
                name: body.name,
                collegeId: body.collegeId,
                companyId: body.companyId,
            },
        });
    }
    async updateDepartment(id, body) {
        return this.prisma.department.update({
            where: { id },
            data: body,
        });
    }
    async deleteDepartment(id) {
        await this.prisma.department.delete({ where: { id } });
        return { success: true };
    }
};
exports.OrganizationController = OrganizationController;
__decorate([
    (0, common_1.Get)('organizations'),
    (0, roles_decorator_1.Roles)('Super Admin'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "getOrganizations", null);
__decorate([
    (0, common_1.Post)('organizations'),
    (0, roles_decorator_1.Roles)('Super Admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "createOrganization", null);
__decorate([
    (0, common_1.Put)('organizations/:id'),
    (0, roles_decorator_1.Roles)('Super Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "updateOrganization", null);
__decorate([
    (0, common_1.Delete)('organizations/:id'),
    (0, roles_decorator_1.Roles)('Super Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "deleteOrganization", null);
__decorate([
    (0, common_1.Get)('companies'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "getCompanies", null);
__decorate([
    (0, common_1.Post)('companies'),
    (0, roles_decorator_1.Roles)('Super Admin', 'Company Admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "createCompany", null);
__decorate([
    (0, common_1.Put)('companies/:id'),
    (0, roles_decorator_1.Roles)('Super Admin', 'Company Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "updateCompany", null);
__decorate([
    (0, common_1.Delete)('companies/:id'),
    (0, roles_decorator_1.Roles)('Super Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "deleteCompany", null);
__decorate([
    (0, common_1.Get)('colleges'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "getColleges", null);
__decorate([
    (0, common_1.Post)('colleges'),
    (0, roles_decorator_1.Roles)('Super Admin', 'College Admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "createCollege", null);
__decorate([
    (0, common_1.Put)('colleges/:id'),
    (0, roles_decorator_1.Roles)('Super Admin', 'College Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "updateCollege", null);
__decorate([
    (0, common_1.Delete)('colleges/:id'),
    (0, roles_decorator_1.Roles)('Super Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "deleteCollege", null);
__decorate([
    (0, common_1.Get)('departments'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('collegeId')),
    __param(4, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "getDepartments", null);
__decorate([
    (0, common_1.Post)('departments'),
    (0, roles_decorator_1.Roles)('Super Admin', 'College Admin', 'Company Admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "createDepartment", null);
__decorate([
    (0, common_1.Put)('departments/:id'),
    (0, roles_decorator_1.Roles)('Super Admin', 'College Admin', 'Company Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "updateDepartment", null);
__decorate([
    (0, common_1.Delete)('departments/:id'),
    (0, roles_decorator_1.Roles)('Super Admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "deleteDepartment", null);
exports.OrganizationController = OrganizationController = __decorate([
    (0, common_1.Controller)('api'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationController);
//# sourceMappingURL=organization.controller.js.map