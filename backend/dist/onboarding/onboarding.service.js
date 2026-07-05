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
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_service_1 = require("../auth/auth.service");
const gitlab_service_1 = require("../gitlab/gitlab.service");
const wiki_service_1 = require("../wiki/wiki.service");
const n8n_service_1 = require("../n8n/n8n.service");
const audit_service_1 = require("../audit/audit.service");
const emailService_1 = require("../../legacy-express/emailService");
let OnboardingService = class OnboardingService {
    constructor(prisma, authService, gitlabService, wikiService, n8nService, auditService) {
        this.prisma = prisma;
        this.authService = authService;
        this.gitlabService = gitlabService;
        this.wikiService = wikiService;
        this.n8nService = n8nService;
        this.auditService = auditService;
    }
    async register(data) {
        const existingRequest = await this.prisma.onboardingRequest.findUnique({
            where: { subdomain: data.subdomain },
        });
        if (existingRequest) {
            throw new common_1.BadRequestException('Subdomain already requested or in use.');
        }
        const request = await this.prisma.onboardingRequest.create({
            data: {
                companyName: data.companyName,
                email: data.email,
                subdomain: data.subdomain,
                domain: data.domain,
                logoUrl: data.logoUrl,
                status: 'PENDING',
            },
        });
        await this.n8nService.emitEvent('company.registration', request);
        return request;
    }
    async getRequests(pageNum = 1, limitNum = 10, search = '', status) {
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { companyName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { subdomain: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await Promise.all([
            this.prisma.onboardingRequest.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.onboardingRequest.count({ where }),
        ]);
        return {
            items,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }
    async approve(id) {
        const request = await this.prisma.onboardingRequest.findUnique({
            where: { id },
        });
        if (!request) {
            throw new common_1.NotFoundException('Onboarding request not found');
        }
        if (request.status !== 'PENDING') {
            throw new common_1.BadRequestException(`Request has already been processed with status: ${request.status}`);
        }
        const organization = await this.prisma.organization.create({
            data: {
                name: request.companyName,
                domain: request.domain || `${request.subdomain}.apnileap.com`,
            },
        });
        await this.auditService.logAction('COMPANY_ONBOARDING_APPROVED', 'SuperAdmin', `Company: ${request.companyName}, SPOC: ${request.email}`);
        const company = await this.prisma.company.create({
            data: {
                name: request.companyName,
                logoUrl: request.logoUrl || `https://logo.clearbit.com/${request.domain || 'apnileap.com'}`,
                organizationId: organization.id,
            },
        });
        const tenant = await this.prisma.tenant.create({
            data: {
                name: request.companyName,
                subdomain: request.subdomain,
                keycloakRealm: `${request.subdomain}-realm`,
                status: 'ACTIVE',
            },
        });
        const spocPassword = 'CompanyAdmin@' + Math.floor(100 + Math.random() * 900);
        const spocUser = await this.authService.register(request.email, spocPassword, `${request.companyName} SPOC`, 'Sponsor');
        let gitlabRepoUrl = '';
        let gitlabBoardUrl = '';
        try {
            console.log(`[GitLab Provisioning] Launching setup for approved company: ${request.companyName}`);
            const group = await this.gitlabService.createGroup(request.companyName, request.subdomain);
            const project = await this.gitlabService.createProject(group.id, 'apnileap-workspace', `Workspace repository for ${request.companyName}`);
            if (project) {
                gitlabRepoUrl = project.web_url || '';
                const board = await this.gitlabService.createGitLabIssueBoard(project.id, `${request.companyName} Kanban Board`);
                gitlabBoardUrl = board?.web_url || '';
                await this.gitlabService.createMilestone(project.id, 'Sprint 1', 'Phase 1 MVP Sprint', '2026-07-25');
                await this.gitlabService.createMilestone(project.id, 'Sprint 2', 'Phase 2 Enhancements Sprint', '2026-08-20');
                const ciTemplate = `stages:
  - build
  - test
  - deploy

build_job:
  stage: build
  image: node:20-alpine
  script:
    - echo "Building code..."
    - npm install || true
    - npm run build || true

test_job:
  stage: test
  image: node:20-alpine
  script:
    - echo "Running tests..."
    - npm test || true

deploy_job:
  stage: deploy
  image: alpine:latest
  script:
    - echo "Deploying deployment manifest..."
`;
                await this.gitlabService.commitCIYaml(project.id, ciTemplate);
                const webhookUrl = `http://localhost:5000/api/gitlab/webhook?projectId=${id}`;
                await this.gitlabService.createWebhook(project.id, webhookUrl);
            }
        }
        catch (gitlabErr) {
            console.warn('[GitLab Provisioning Failed] Skipping integration setup:', gitlabErr.message);
        }
        try {
            await (0, emailService_1.sendEmail)({
                to: request.email,
                subject: `🎉 [APNILEAP] Onboarding Approved: ${request.companyName}`,
                body: `Dear ${request.companyName} Admin,\n\nYour organization onboarding request has been successfully approved!\n\nYour workspace details:\n- Organization Name: ${request.companyName}\n- Subdomain: http://${request.subdomain}.apnileap.com\n- Admin Username: ${request.email}\n- Admin Temporary Password: ${spocPassword}\n\nGitLab Resources:\n- Repository URL: ${gitlabRepoUrl || 'Mocked GitLab'}\n- Agile Boards URL: ${gitlabBoardUrl || 'Mocked GitLab'}\n\nWiki.js Documentation Workspace:\n- Space URL: ${wikiSpaceUrl || 'Mocked Wiki'}\n- Welcome Page URL: ${wikiPageUrl || 'Mocked Wiki'}\n\nPlease login to secure your dashboard.\n\nBest regards,\nAPNILEAP Administrator`,
                type: 'onboarding_approval',
            });
        }
        catch (mailErr) {
            console.warn('Failed to send onboarding approval notification email:', mailErr.message);
        }
        const n8nPayload = {
            organizationId: organization.id,
            companyId: company.id,
            tenantId: tenant.id,
            companyName: request.companyName,
            subdomain: request.subdomain,
            domain: request.domain,
            email: request.email,
            spocPassword,
            spocUser: spocUser.user,
            gitlabRepoUrl,
            gitlabBoardUrl,
            wikiPageUrl,
            wikiSpaceUrl,
        };
        await this.n8nService.emitEvent('company.approval', n8nPayload);
        await this.prisma.onboardingRequest.update({
            where: { id },
            data: { status: 'APPROVED' },
        });
        return {
            success: true,
            organizationId: organization.id,
            companyId: company.id,
            tenantId: tenant.id,
            spocUser: spocUser.user,
            gitlabRepoUrl,
            gitlabBoardUrl,
            wikiPageUrl,
            wikiSpaceUrl,
        };
    }
    async reject(id, comments) {
        const request = await this.prisma.onboardingRequest.findUnique({
            where: { id },
        });
        if (!request) {
            throw new common_1.NotFoundException('Onboarding request not found');
        }
        if (request.status !== 'PENDING') {
            throw new common_1.BadRequestException('Onboarding request is already processed.');
        }
        await this.prisma.onboardingRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                comments: comments || 'Does not meet partner program requirements.',
            },
        });
        await this.auditService.logAction('COMPANY_ONBOARDING_REJECTED', 'SuperAdmin', `Company: ${request.companyName}, Reason: ${comments || 'No explanation provided'}`);
        try {
            await (0, emailService_1.sendEmail)({
                to: request.email,
                subject: `⚠️ [APNILEAP] Onboarding Status Update: ${request.companyName}`,
                body: `Dear ${request.companyName} Representative,\n\nThank you for your interest in APNILEAP.\n\nWe regret to inform you that your request for onboarding has been declined due to the following reason:\n"${comments || 'Does not meet partner program criteria.'}"\n\nFor more details, contact admin@apnileap.com.\n\nBest regards,\nAPNILEAP Administrator`,
                type: 'onboarding_rejection',
            });
        }
        catch (mailErr) {
            console.warn('Failed to send onboarding rejection email:', mailErr.message);
        }
        return { success: true };
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService,
        gitlab_service_1.GitlabService,
        wiki_service_1.WikiService,
        n8n_service_1.N8nService,
        audit_service_1.AuditService])
], OnboardingService);
//# sourceMappingURL=onboarding.service.js.map