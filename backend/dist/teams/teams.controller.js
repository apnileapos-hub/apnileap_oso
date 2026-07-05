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
exports.TeamsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
let TeamsController = class TeamsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTeams(boardId) {
        const spokeKey = boardId === '3' ? 'kle-spoke' : (boardId === '101' ? 'coep-spoke' : (boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));
        if (boardId) {
            return this.prisma.team.findMany({
                where: { collegeId: spokeKey },
            });
        }
        return this.prisma.team.findMany();
    }
    async createTeam(body) {
        const teamId = 'team-' + Date.now();
        const spokeKey = body.boardId === '3' ? 'kle-spoke' : (body.boardId === '101' ? 'coep-spoke' : (body.boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));
        const team = await this.prisma.team.create({
            data: {
                id: teamId,
                name: body.name,
                members: body.members || [],
                collegeId: spokeKey,
            },
        });
        return { success: true, id: team.id, name: team.name, members: team.members };
    }
    async deleteTeam(id) {
        await this.prisma.team.delete({ where: { id } });
        return { success: true };
    }
    async allocateTeamToProject(projectIdStr, body) {
        const projectId = parseInt(projectIdStr);
        const teamId = 'team-' + Date.now() + Math.random().toString(36).substr(2, 5);
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });
        const spokeId = project ? project.spokeId : null;
        const team = await this.prisma.team.create({
            data: {
                id: teamId,
                name: body.name,
                members: [],
                collegeId: spokeId,
            },
        });
        if (project) {
            await this.prisma.project.update({
                where: { id: projectId },
                data: { teamId: team.id },
            });
        }
        return { success: true, teamId: team.id, name: team.name };
    }
};
exports.TeamsController = TeamsController;
__decorate([
    (0, common_1.Get)('api/teams'),
    __param(0, (0, common_1.Query)('boardId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "getTeams", null);
__decorate([
    (0, common_1.Post)('api/teams'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "createTeam", null);
__decorate([
    (0, common_1.Delete)('api/teams/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "deleteTeam", null);
__decorate([
    (0, common_1.Post)('allocations/:id/teams'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TeamsController.prototype, "allocateTeamToProject", null);
exports.TeamsController = TeamsController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TeamsController);
//# sourceMappingURL=teams.controller.js.map