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
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const genai_1 = require("@google/genai");
const tasks_service_1 = require("../tasks/tasks.service");
let ProjectsController = class ProjectsController {
    constructor(prisma, tasksService) {
        this.prisma = prisma;
        this.tasksService = tasksService;
    }
    async getProjects() {
        const projects = await this.prisma.project.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return projects;
    }
    async autoAssignProject(body) {
        const project = await this.prisma.project.findUnique({
            where: { id: body.projectId }
        });
        if (!project)
            throw new Error('Project not found');
        await this.prisma.project.update({
            where: { id: body.projectId },
            data: {
                status: 'Assigned',
                spokeId: body.targetBoardId === '3' ? 'kle-spoke' : (body.targetBoardId === '101' ? 'coep-spoke' : (body.targetBoardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'))
            }
        });
        let createdTasks = [];
        if (project.epics && Array.isArray(project.epics)) {
            for (const phase of project.epics) {
                const task = await this.tasksService.createTask({
                    boardId: body.targetBoardId,
                    summary: phase.title || 'AI Phase',
                    description: phase.description || '',
                    issueTypeName: 'Task',
                    statusName: 'Backlog',
                    dueDate: body.dueDate
                }, 'Central Moderator');
                createdTasks.push(task);
            }
        }
        return {
            success: true,
            assignedTo: body.targetBoardId === '3' ? 'KLE Hub' : 'Partner Hub',
            tasksCreated: createdTasks.length
        };
    }
    async createProject(body) {
        const { company, title, description: srsDocument, budget, duration, proposedDueDate } = body;
        const generatedPhases = await this.realAiGeneratePhases(title, srsDocument);
        const project = await this.prisma.project.create({
            data: {
                title: title,
                description: srsDocument,
                status: 'Proposal',
                budget: budget ? parseFloat(budget.replace(/[^0-9.-]+/g, '')) : 0,
                durationWeeks: duration ? parseInt(duration) : 0,
                epics: generatedPhases,
            },
        });
        return { success: true, project };
    }
    async realAiGeneratePhases(title, srs) {
        try {
            const ai = new genai_1.GoogleGenAI({
                vertexai: true,
                project: 'apnileap',
                location: 'us-central1',
            });
            const prompt = `
You are an expert technical project manager and architect. 
I am providing you with the Software Requirements Specification (SRS) for a project titled "${title}".
Please analyze this document and design the core project phases and milestones.
Output the result strictly as a JSON array of objects. Do not include markdown code blocks, just the raw JSON.
Each object in the array should represent a phase and have the following schema:
- "id": a number representing the phase order (1, 2, 3...)
- "title": a string (e.g., "Phase 1: Architecture")
- "description": a short description of the phase goal.
- "status": exactly the string "To Do"
- "tasks": an array of objects, where each object has a "title" (string) and "status" (exactly "To Do").

Here is the SRS Document:
${srs}
      `;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                }
            });
            if (response.text) {
                return JSON.parse(response.text);
            }
            return [];
        }
        catch (error) {
            console.error('Error calling Gemini AI:', error);
            return this.mockAiGeneratePhases(title, srs);
        }
    }
    mockAiGeneratePhases(title, srs) {
        return [
            {
                id: 1,
                title: 'Phase 1: Requirements & Architecture',
                description: `Analyze the provided SRS document and establish the core architecture for ${title}.`,
                status: 'To Do',
                tasks: [
                    { title: 'Finalize SRS review with stakeholders', status: 'To Do' },
                    { title: 'Draft System Architecture Document', status: 'To Do' }
                ]
            },
            {
                id: 2,
                title: 'Phase 2: Core Implementation',
                description: 'Build the primary features and endpoints outlined in the SRS.',
                status: 'To Do',
                tasks: [
                    { title: 'Setup database schemas', status: 'To Do' },
                    { title: 'Develop core API endpoints', status: 'To Do' },
                    { title: 'Implement UI components', status: 'To Do' }
                ]
            },
            {
                id: 3,
                title: 'Phase 3: QA & Delivery',
                description: 'Testing, QA, and handover of the completed project.',
                status: 'To Do',
                tasks: [
                    { title: 'Perform integration testing', status: 'To Do' },
                    { title: 'User Acceptance Testing (UAT)', status: 'To Do' },
                    { title: 'Final Deployment', status: 'To Do' }
                ]
            }
        ];
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Get)('projects'),
    (0, roles_decorator_1.Roles)('Super Admin', 'Company Admin', 'Moderator', 'Campus Moderator', 'Student'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getProjects", null);
__decorate([
    (0, common_1.Post)('assign'),
    (0, roles_decorator_1.Roles)('Super Admin', 'Company Admin', 'Moderator'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "autoAssignProject", null);
__decorate([
    (0, common_1.Post)('projects'),
    (0, roles_decorator_1.Roles)('Super Admin', 'Company Admin', 'Moderator'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "createProject", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, common_1.Controller)('moderator'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tasks_service_1.TasksService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map