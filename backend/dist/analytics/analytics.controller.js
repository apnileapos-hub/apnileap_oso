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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
let AnalyticsController = class AnalyticsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardMetrics() {
        try {
            const tasks = await this.prisma.mockTask.findMany();
            const total = tasks.length;
            let open = 0;
            let inProgress = 0;
            let done = 0;
            let totalAgeDays = 0;
            const now = Date.now();
            tasks.forEach(t => {
                const fields = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
                const s = (fields?.status?.name || '').toLowerCase();
                if (s.includes('done') || s.includes('closed') || s.includes('resolved')) {
                    done++;
                }
                else if (s.includes('progress') || s.includes('review') || s.includes('testing')) {
                    inProgress++;
                }
                else {
                    open++;
                }
                if (fields?.created) {
                    totalAgeDays += (now - new Date(fields.created).getTime()) / (1000 * 60 * 60 * 24);
                }
            });
            const avgAgeDays = total > 0 ? Math.round(totalAgeDays / total) : 0;
            return { total, open, inProgress, done, avgAgeDays };
        }
        catch (err) {
            console.error('Error in /dashboard-metrics:', err.message);
            return { total: 0, open: 0, inProgress: 0, done: 0, avgAgeDays: 0 };
        }
    }
    async getHubMetrics() {
        try {
            const projects = await this.prisma.project.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
            });
            const b2bProjects = [];
            const SPOKES_MAP = {
                '3': 'KLE Hub',
                '101': 'COEP Hub',
                '102': 'MMCOEP Hub',
                '103': 'RIT Hub',
                'kle-spoke': 'KLE Hub',
                'coep-spoke': 'COEP Hub',
                'mmcoep-spoke': 'MMCOEP Hub',
                'rit-spoke': 'RIT Hub',
            };
            const getSpokeName = (id) => SPOKES_MAP[id] || id || 'Campus Hub';
            const getSpokeId = (name) => {
                if (!name)
                    return null;
                const n = name.toLowerCase();
                if (n.includes('mmcoep'))
                    return '102';
                if (n.includes('kle'))
                    return '3';
                if (n.includes('coep'))
                    return '101';
                if (n.includes('rit'))
                    return '103';
                return name;
            };
            for (const p of projects) {
                const company = p.companyId ? await this.prisma.company.findUnique({ where: { id: p.companyId } }) : null;
                const budgetStr = p.budget ? `$${p.budget.toString()}` : '$0';
                const spokeName = getSpokeName(p.spokeId || '');
                const campusId = getSpokeId(p.spokeId || '');
                const statusFormatted = p.status === 'ACCEPTED' || p.status === 'IN_PROGRESS' || p.status === 'active'
                    ? 'Active'
                    : p.status === 'ALLOCATED' || p.status === 'proposed'
                        ? 'Proposed'
                        : 'Pending Assignment';
                let allocations = [];
                if (p.spokeId) {
                    const mentorUsers = await this.prisma.user.findMany({
                        where: {
                            collegeId: p.spokeId,
                            role: 'College-SPOC',
                        },
                    });
                    const mentorAssignments = mentorUsers.map(mu => ({ facultyId: mu.id }));
                    const teams = await this.prisma.team.findMany({
                        where: { projectId: p.id },
                    });
                    const mappedTeams = teams.map(t => {
                        const membersArray = Array.isArray(t.members) ? t.members : [];
                        return {
                            id: t.id,
                            name: t.name,
                            studentAssignments: membersArray.map(mId => ({ studentId: parseInt(mId) || 0 })),
                        };
                    });
                    allocations = [
                        {
                            id: p.id.toString(),
                            targetCampusId: p.spokeId,
                            assignedTo: spokeName,
                            status: statusFormatted,
                            proposedDueDate: '2026-08-25',
                            assignedKey: p.jiraProjectKey || null,
                            progressPercent: 75,
                            doneTasks: 6,
                            mentorAssignments,
                            teams: mappedTeams,
                        },
                    ];
                }
                b2bProjects.push({
                    id: `proj-${p.id}`,
                    company: company?.name || 'Acme Corp',
                    logoUrl: company?.logoUrl || 'https://logo.clearbit.com/company.com?size=80',
                    title: p.title,
                    description: p.description || '',
                    budget: budgetStr,
                    duration: p.durationWeeks ? `${p.durationWeeks} Weeks` : '12 Weeks',
                    status: statusFormatted,
                    assignedTo: p.spokeId ? spokeName : null,
                    targetCampusId: campusId,
                    proposedDueDate: '2026-08-25',
                    assignedKey: p.jiraProjectKey || null,
                    dateAdded: p.createdAt.toISOString().split('T')[0],
                    allocations,
                });
            }
            const spokesList = [
                { id: '3', name: 'KLE Hub', key: 'AK' },
                { id: '101', name: 'COEP Hub', key: 'AK' },
                { id: '102', name: 'MMCOEP Hub', key: 'AK' },
                { id: '103', name: 'RIT Hub', key: 'AK' },
            ];
            const spokesMetrics = [];
            const blockers = [];
            for (const sp of spokesList) {
                const tasks = await this.prisma.mockTask.findMany({
                    where: { boardId: sp.id },
                });
                const mockTasks = tasks.map(t => {
                    const fields = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
                    return {
                        id: t.id,
                        key: t.key,
                        fields: {
                            summary: fields.summary || '',
                            status: { name: fields.status?.name || 'To Do' },
                            priority: { name: fields.priority?.name || 'Medium' },
                            issuetype: { name: fields.issuetype?.name || 'Task' },
                            assignee: fields.assignee ? { displayName: fields.assignee.displayName } : null,
                            flagged: fields.flagged || false,
                        },
                    };
                });
                let total = 0;
                let done = 0;
                let progress = 0;
                let backlog = 0;
                let blockersCount = 0;
                mockTasks.forEach(t => {
                    const status = (t.fields.status?.name || 'To Do').toLowerCase();
                    total++;
                    if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
                        done++;
                    }
                    else if (status.includes('progress') || status.includes('review') || status.includes('testing')) {
                        progress++;
                    }
                    else {
                        backlog++;
                    }
                    if (t.fields.flagged) {
                        blockersCount++;
                        blockers.push({
                            id: t.id,
                            key: t.key,
                            summary: t.fields.summary,
                            statusName: t.fields.status?.name || 'To Do',
                            priority: t.fields.priority?.name || 'Medium',
                            spokeName: sp.name,
                            assignee: t.fields.assignee,
                        });
                    }
                });
                spokesMetrics.push({
                    id: sp.id,
                    name: sp.name,
                    key: sp.key,
                    total,
                    done,
                    progress,
                    backlog,
                    blockersCount,
                    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
                });
            }
            return {
                spokes: spokesMetrics,
                workstreams: [],
                blockers,
                b2bProjects,
            };
        }
        catch (err) {
            console.error('Error in /hub/metrics:', err.message);
            return { spokes: [], workstreams: [], blockers: [], b2bProjects: [] };
        }
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('dashboard-metrics'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getDashboardMetrics", null);
__decorate([
    (0, common_1.Get)('hub/metrics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getHubMetrics", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map