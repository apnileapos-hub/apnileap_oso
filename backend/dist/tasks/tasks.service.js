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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const gitlab_service_1 = require("../gitlab/gitlab.service");
const audit_service_1 = require("../audit/audit.service");
const emailService_1 = require("../../legacy-express/emailService");
let TasksService = class TasksService {
    constructor(prisma, gitlabService, auditService) {
        this.prisma = prisma;
        this.gitlabService = gitlabService;
        this.auditService = auditService;
        this.SPOKES = {
            '3': { name: 'KLE Hub', key: 'AK', boardId: 75 },
            '101': { name: 'COEP Hub', key: 'AK', boardId: 76 },
            '102': { name: 'MMCOEP Hub', key: 'AK', boardId: 77 },
            '103': { name: 'RIT Hub', key: 'AK', boardId: 78 },
        };
        this.CAMPUS_LABELS = {
            '3': 'kle-spoke',
            '101': 'coep-spoke',
            '102': 'mmcoep-spoke',
            '103': 'rit-spoke',
        };
        this.MOCK_ASSIGNEES = [
            { accountId: 'mock-1', displayName: 'Manasa Vasare (Coordinator)', emailAddress: 'coordinator@kle.edu', email: 'coordinator@kle.edu' },
            { accountId: 'mock-kle-student', displayName: 'KLE Student Developer', emailAddress: 'student@kle.edu', email: 'student@kle.edu' },
            { accountId: 'mock-coep-student', displayName: 'COEP Student Developer', emailAddress: 'student@coep.edu', email: 'student@coep.edu' },
            { accountId: 'mock-rit-student', displayName: 'RIT Student Developer', emailAddress: 'student@rit.edu', email: 'student@rit.edu' },
        ];
    }
    async getTasks(boardId = '3') {
        const tasks = await this.prisma.mockTask.findMany({
            where: { boardId },
            orderBy: { createdAt: 'desc' },
        });
        return tasks.map(t => ({
            id: t.id,
            key: t.key,
            fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields,
        }));
    }
    async createTask(body, actorName = 'Platform Automation') {
        const targetBoardId = body.boardId || '3';
        const spoke = this.SPOKES[targetBoardId];
        const key = spoke ? `${spoke.key}-${Math.floor(Math.random() * 1000) + 100}` : `MOCK-${Date.now()}`;
        const taskId = `mock-${targetBoardId}-${Date.now()}`;
        const assignedUser = this.MOCK_ASSIGNEES.find(a => a.accountId === body.assigneeId) || null;
        const reporterUser = body.reporterId ? this.MOCK_ASSIGNEES.find(a => a.accountId === body.reporterId) || this.MOCK_ASSIGNEES[0] : this.MOCK_ASSIGNEES[0];
        const fields = {
            summary: body.summary || 'Sprint Task',
            description: body.description || '',
            status: { name: body.statusName || 'Backlog' },
            priority: { name: body.priorityName || 'Medium' },
            issuetype: { name: body.issueTypeName || 'Task' },
            assignee: assignedUser,
            reporter: reporterUser,
            created: new Date().toISOString(),
            duedate: body.dueDate || null,
            subtasks: [],
            issuelinks: [],
            labels: body.parentId ? ['B2B-Task', this.CAMPUS_LABELS[targetBoardId] || 'kle-spoke'] : [],
            parent: body.parentId ? {
                id: body.parentId,
                key: body.parentKey,
                summary: body.parentSummary,
                issueType: 'Epic',
            } : null,
            worklogs: [],
            timetracking: { timeSpent: '0h', timeSpentSeconds: 0 },
            flagged: false,
        };
        const mockTask = await this.prisma.mockTask.create({
            data: {
                id: taskId,
                key,
                boardId: targetBoardId,
                fields,
            },
        });
        await this.auditService.logAction('TASK_CREATED', actorName, `Task: ${key} (Summary: ${fields.summary})`);
        this.prisma.project.findFirst({
            where: { spokeId: this.CAMPUS_LABELS[targetBoardId] },
        }).then(async (project) => {
            if (project) {
                try {
                    const gitlabIssue = await this.gitlabService.createIssue(project.id, fields.summary, fields.description, fields.labels);
                    if (gitlabIssue) {
                        const updatedFields = { ...fields };
                        const realKey = `${project.jiraProjectKey || 'APNI'}-${gitlabIssue.iid}`;
                        await this.prisma.mockTask.update({
                            where: { id: taskId },
                            data: {
                                id: gitlabIssue.id.toString(),
                                key: realKey,
                            },
                        });
                        console.log(`[GitLab Sync] Created issue #${gitlabIssue.iid} and updated local key $\\rightarrow$ ${realKey}`);
                    }
                }
                catch (gitlabErr) {
                    console.warn('[GitLab Sync Failed] Issue creation bypassed:', gitlabErr.message);
                }
            }
        });
        return { success: true, key, id: taskId };
    }
    async updateTask(key, body) {
        const task = await this.prisma.mockTask.findUnique({ where: { key } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
        if (body.summary !== undefined)
            fields.summary = body.summary;
        if (body.description !== undefined)
            fields.description = body.description;
        if (body.dueDate !== undefined)
            fields.duedate = body.dueDate === '' ? null : body.dueDate;
        if (body.priority !== undefined)
            fields.priority = { name: body.priority };
        if (body.assignee !== undefined) {
            fields.assignee = this.MOCK_ASSIGNEES.find(a => a.accountId === body.assignee) || null;
        }
        if (body.reporter !== undefined) {
            fields.reporter = this.MOCK_ASSIGNEES.find(a => a.accountId === body.reporter) || null;
        }
        await this.prisma.mockTask.update({
            where: { key },
            data: { fields },
        });
        this.prisma.project.findFirst({
            where: { spokeId: this.CAMPUS_LABELS[task.boardId] },
        }).then(async (project) => {
            if (project && task.key.includes('-')) {
                const issueIid = parseInt(task.key.split('-')[1]);
                if (!isNaN(issueIid)) {
                }
            }
        });
        return { success: true };
    }
    async transitionTask(key, status) {
        const task = await this.prisma.mockTask.findUnique({ where: { key } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
        fields.status = { name: status };
        await this.prisma.mockTask.update({
            where: { key },
            data: { fields },
        });
        await this.auditService.logAction('TASK_TRANSITIONED', 'Developer', `Task: ${key} transitioned to status: ${status}`);
        this.prisma.project.findFirst({
            where: { spokeId: this.CAMPUS_LABELS[task.boardId] },
        }).then(async (project) => {
            if (project && task.key.includes('-')) {
                const issueIid = parseInt(task.key.split('-')[1]);
                if (!isNaN(issueIid)) {
                    await this.gitlabService.transitionIssue(project.id, issueIid, status);
                }
            }
        });
        return { success: true };
    }
    async deleteTask(key) {
        await this.prisma.mockTask.delete({ where: { key } });
        return { success: true };
    }
    async flagTask(key, flagged) {
        const task = await this.prisma.mockTask.findUnique({ where: { key } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
        fields.flagged = flagged;
        await this.prisma.mockTask.update({
            where: { key },
            data: { fields },
        });
        return { success: true };
    }
    async updateLabels(key, labels) {
        const task = await this.prisma.mockTask.findUnique({ where: { key } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
        fields.labels = labels;
        await this.prisma.mockTask.update({
            where: { key },
            data: { fields },
        });
        return { success: true };
    }
    async postWorklog(key, body) {
        const task = await this.prisma.mockTask.findUnique({ where: { key } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
        if (!fields.worklogs)
            fields.worklogs = [];
        fields.worklogs.push({
            id: `mock-wl-${Date.now()}`,
            timeSpent: body.timeSpent,
            comment: body.comment || 'Logged hours spent via Dashboard',
            created: new Date().toISOString(),
            author: this.MOCK_ASSIGNEES[0],
        });
        if (!fields.timetracking) {
            fields.timetracking = { timeSpentSeconds: 0, timeSpent: '0h' };
        }
        fields.timetracking.timeSpent = body.timeSpent;
        fields.timetracking.timeSpentSeconds = (fields.timetracking.timeSpentSeconds || 0) + 7200;
        await this.prisma.mockTask.update({
            where: { key },
            data: { fields },
        });
        this.prisma.project.findFirst({
            where: { spokeId: this.CAMPUS_LABELS[task.boardId] },
        }).then(async (project) => {
            if (project && task.key.includes('-')) {
                const issueIid = parseInt(task.key.split('-')[1]);
                if (!isNaN(issueIid)) {
                    const commentText = `⏱️ **[Worklog Logged]** Time Spent: ${body.timeSpent}\n\n_${body.comment || 'Logged work hours spent via ApniLeap Dashboard'}_`;
                    await this.gitlabService.createIssueNote(project.id, issueIid, commentText);
                }
            }
        });
        return { success: true };
    }
    async getWorklogs(key) {
        const task = await this.prisma.mockTask.findUnique({ where: { key } });
        if (!task)
            return [];
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
        return fields.worklogs || [];
    }
    async createSubtask(key, body) {
        const parentTask = await this.prisma.mockTask.findUnique({ where: { key } });
        if (!parentTask)
            throw new common_1.NotFoundException('Parent task not found');
        const parentFields = typeof parentTask.fields === 'string' ? JSON.parse(parentTask.fields) : parentTask.fields;
        const projectKey = key.split('-')[0];
        const newKey = `${projectKey}-${Math.floor(Math.random() * 1000) + 100}`;
        const newId = `mock-sub-${Date.now()}`;
        const newChildFields = {
            summary: body.summary,
            description: '',
            status: { name: 'Backlog' },
            priority: { name: 'Medium' },
            issuetype: { name: body.parentIssueType === 'Epic' ? 'Task' : 'Sub-task' },
            assignee: body.assigneeId ? this.MOCK_ASSIGNEES.find(a => a.accountId === body.assigneeId) || null : null,
            reporter: this.MOCK_ASSIGNEES[0],
            created: new Date().toISOString(),
            duedate: null,
            subtasks: [],
            issuelinks: [],
            parent: {
                id: parentTask.id,
                key: parentTask.key,
                fields: {
                    summary: parentFields.summary,
                    issuetype: { name: parentFields.issuetype?.name || 'Task' },
                },
            },
        };
        await this.prisma.mockTask.create({
            data: {
                id: newId,
                key: newKey,
                boardId: parentTask.boardId,
                fields: newChildFields,
            },
        });
        if (body.parentIssueType !== 'Epic') {
            if (!parentFields.subtasks)
                parentFields.subtasks = [];
            parentFields.subtasks.push({
                id: newId,
                key: newKey,
                summary: body.summary,
                statusName: 'Backlog',
            });
            await this.prisma.mockTask.update({
                where: { key },
                data: { fields: parentFields },
            });
        }
        return { success: true, key: newKey, id: newId };
    }
    async sendReminder(body) {
        const { recipient, subject, taskKey, taskSummary, dueDate, message } = body;
        try {
            await (0, emailService_1.sendEmail)({
                to: recipient,
                subject,
                body: `Urgent Sprint deadline alert:\n- Task: ${taskKey} (${taskSummary})\n- Due Date: ${dueDate}\n\n${message}`,
                type: 'deadline_warning',
            });
        }
        catch (err) {
            console.warn('Failed to send mail reminder:', err.message);
        }
        return { success: true };
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gitlab_service_1.GitlabService,
        audit_service_1.AuditService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map