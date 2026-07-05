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
exports.GitlabController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let GitlabController = class GitlabController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleWebhook(body, queryProjectId, gitlabEvent) {
        console.log(`📥 [GitLab Webhook] Received event type: "${gitlabEvent || body.object_kind}"`);
        const objectKind = body.object_kind || (gitlabEvent ? gitlabEvent.toLowerCase().replace(' hook', '') : '');
        try {
            if (objectKind === 'issue') {
                await this.handleIssueEvent(body);
            }
            else if (objectKind === 'pipeline') {
                this.handlePipelineEvent(body);
            }
            else if (objectKind === 'push') {
                this.handlePushEvent(body);
            }
            else if (objectKind === 'merge_request') {
                this.handleMergeRequestEvent(body);
            }
        }
        catch (err) {
            console.error('[GitLab Webhook] Process error:', err.message);
        }
        return { success: true };
    }
    async handleIssueEvent(body) {
        const issueAttr = body.object_attributes;
        if (!issueAttr)
            return;
        const gitlabIssueId = issueAttr.id.toString();
        const issueIid = issueAttr.iid;
        const labels = body.labels || [];
        const labelNames = labels.map((l) => l.title);
        console.log(`[Issue Event] Issue #${issueIid} ("${issueAttr.title}") | Labels: [${labelNames.join(', ')}]`);
        let status = 'To Do';
        if (labelNames.includes('Done'))
            status = 'Done';
        else if (labelNames.includes('Testing'))
            status = 'Testing';
        else if (labelNames.includes('In Review'))
            status = 'In Review';
        else if (labelNames.includes('In Progress'))
            status = 'In Progress';
        const task = await this.prisma.mockTask.findFirst({
            where: {
                OR: [
                    { id: gitlabIssueId },
                    { key: { endsWith: `-${issueIid}` } },
                ],
            },
        });
        if (task) {
            const currentFields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
            const updatedFields = {
                ...currentFields,
                status: { name: status },
            };
            await this.prisma.mockTask.update({
                where: { id: task.id },
                data: {
                    fields: updatedFields,
                },
            });
            console.log(`[Database Sync] Updated task key ${task.key} status $\\rightarrow$ "${status}"`);
        }
        else {
            console.warn(`[Database Sync] Task matching GitLab issue ID ${gitlabIssueId} or #${issueIid} not found in DB.`);
        }
    }
    handlePipelineEvent(body) {
        const pipelineAttr = body.object_attributes;
        if (!pipelineAttr)
            return;
        console.log(`🚀 [CI/CD Pipeline] Runner Status: "${pipelineAttr.status.toUpperCase()}" | ID: ${pipelineAttr.id} | Ref: ${pipelineAttr.ref} | Duration: ${pipelineAttr.duration || 0}s`);
    }
    handlePushEvent(body) {
        const commits = body.commits || [];
        console.log(`💻 [Push Commit] User "${body.user_name}" pushed ${commits.length} commit(s) to branch "${body.ref}"`);
        commits.forEach((c) => {
            console.log(`  - [${c.id.slice(0, 8)}] "${c.message.trim()}"`);
        });
    }
    handleMergeRequestEvent(body) {
        const mrAttr = body.object_attributes;
        if (!mrAttr)
            return;
        console.log(`🔀 [Merge Request] #${mrAttr.iid} "${mrAttr.title}" | State: "${mrAttr.state.toUpperCase()}" | Action: "${mrAttr.action}"`);
    }
};
exports.GitlabController = GitlabController;
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('projectId')),
    __param(2, (0, common_1.Headers)('x-gitlab-event')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], GitlabController.prototype, "handleWebhook", null);
exports.GitlabController = GitlabController = __decorate([
    (0, common_1.Controller)('api/gitlab'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GitlabController);
//# sourceMappingURL=gitlab.controller.js.map