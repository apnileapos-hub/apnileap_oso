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
exports.SubmissionsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const gitlab_service_1 = require("../gitlab/gitlab.service");
const audit_service_1 = require("../audit/audit.service");
let SubmissionsController = class SubmissionsController {
    constructor(prisma, gitlabService, auditService) {
        this.prisma = prisma;
        this.gitlabService = gitlabService;
        this.auditService = auditService;
    }
    async submitDeliverable(taskId, body) {
        if (!body.studentName || !body.fileName || !body.fileUrl) {
            throw new common_1.BadRequestException('Missing studentName, fileName, or fileUrl');
        }
        const submission = await this.prisma.submission.create({
            data: {
                taskId,
                studentName: body.studentName,
                fileName: body.fileName,
                fileUrl: body.fileUrl,
                comments: body.comments || '',
                status: 'Pending Review',
                feedback: '',
            },
        });
        await this.auditService.logAction('DELIVERABLE_SUBMITTED', body.studentName, `Task: ${taskId}, File: ${body.fileName}`);
        return { success: true, submission };
    }
    async getTaskSubmissions(taskId) {
        return this.prisma.submission.findMany({
            where: { taskId },
            orderBy: { submittedAt: 'desc' },
        });
    }
    async getAllSubmissions() {
        return this.prisma.submission.findMany({
            orderBy: { submittedAt: 'desc' },
        });
    }
    async updateStatus(id, body) {
        if (!body.status || !['Approved', 'Re-work Requested'].includes(body.status)) {
            throw new common_1.BadRequestException("Status must be 'Approved' or 'Re-work Requested'");
        }
        const submission = await this.prisma.submission.findUnique({
            where: { id },
        });
        if (!submission) {
            throw new common_1.NotFoundException('Submission record not found');
        }
        const updatedSub = await this.prisma.submission.update({
            where: { id },
            data: {
                status: body.status,
                feedback: body.feedback || '',
            },
        });
        await this.auditService.logAction('DELIVERABLE_REVIEWED', 'Mentor', `Submission ID: ${id}, Task: ${submission.taskId}, Decision: ${body.status}`);
        try {
            const taskId = submission.taskId;
            const targetStatus = body.status === 'Approved' ? 'Done' : 'In Progress';
            const task = await this.prisma.mockTask.findFirst({
                where: {
                    OR: [
                        { id: taskId },
                        { key: taskId },
                    ],
                },
            });
            if (task) {
                const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
                fields.status = { name: targetStatus };
                if (body.status === 'Re-work Requested') {
                    fields.flagged = true;
                    fields.description = `${fields.description || ''}\n\n⚠️ [MENTOR FEEDBACK]: ${body.feedback}`;
                }
                else {
                    fields.flagged = false;
                }
                await this.prisma.mockTask.update({
                    where: { id: task.id },
                    data: { fields },
                });
                this.prisma.project.findFirst({
                    where: { spokeId: task.boardId === '3' ? 'kle-spoke' : (task.boardId === '101' ? 'coep-spoke' : (task.boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke')) },
                }).then(async (project) => {
                    if (project && task.key.includes('-')) {
                        const issueIid = parseInt(task.key.split('-')[1]);
                        if (!isNaN(issueIid)) {
                            await this.gitlabService.transitionIssue(project.id, issueIid, targetStatus);
                            if (body.status === 'Re-work Requested') {
                                await this.gitlabService.createIssueNote(project.id, issueIid, `⚠️ [RE-WORK REQUESTED BY COORDINATOR]:\n${body.feedback}`);
                            }
                        }
                    }
                });
            }
        }
        catch (reactiveErr) {
            console.warn('[Reactive Automation Failed] Task transition bypassed:', reactiveErr.message);
        }
        return { success: true, submission: updatedSub };
    }
    async deleteSubmission(id) {
        await this.prisma.submission.delete({ where: { id } });
        return { success: true };
    }
};
exports.SubmissionsController = SubmissionsController;
__decorate([
    (0, common_1.Post)('tasks/:taskId/submit'),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "submitDeliverable", null);
__decorate([
    (0, common_1.Get)('tasks/:taskId/submissions'),
    __param(0, (0, common_1.Param)('taskId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "getTaskSubmissions", null);
__decorate([
    (0, common_1.Get)('submissions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "getAllSubmissions", null);
__decorate([
    (0, common_1.Put)('submissions/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Delete)('submissions/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SubmissionsController.prototype, "deleteSubmission", null);
exports.SubmissionsController = SubmissionsController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gitlab_service_1.GitlabService,
        audit_service_1.AuditService])
], SubmissionsController);
//# sourceMappingURL=submissions.controller.js.map