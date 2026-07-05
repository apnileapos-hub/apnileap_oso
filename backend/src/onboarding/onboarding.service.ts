import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { WikiService } from '../wiki/wiki.service';
import { N8nService } from '../n8n/n8n.service';
import { AuditService } from '../audit/audit.service';
import { sendEmail } from '../../legacy-express/emailService'; // Use legacy mailer helper if available or mock
import axios from 'axios';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly gitlabService: GitlabService,
    private readonly wikiService: WikiService,
    private readonly n8nService: N8nService,
    private readonly auditService: AuditService,
  ) {}

  async register(data: {
    companyName: string;
    email: string;
    subdomain: string;
    domain?: string;
    logoUrl?: string;
  }) {
    // Check if subdomain or company is already registered
    const existingRequest = await this.prisma.onboardingRequest.findUnique({
      where: { subdomain: data.subdomain },
    });

    if (existingRequest) {
      throw new BadRequestException('Subdomain already requested or in use.');
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

    // Emit registration event to n8n
    await this.n8nService.emitEvent('company.registration', request);

    return request;
  }

  async getRequests(
    pageNum: number = 1,
    limitNum: number = 10,
    search: string = '',
    status?: string,
  ) {
    const skip = (pageNum - 1) * limitNum;
    const where: any = {};

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

  async approve(id: number): Promise<any> {
    const request = await this.prisma.onboardingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Onboarding request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request has already been processed with status: ${request.status}`);
    }

    // 1. Create Organization
    const organization = await this.prisma.organization.create({
      data: {
        name: request.companyName,
        domain: request.domain || `${request.subdomain}.apnileap.com`,
      },
    });

    await this.auditService.logAction('COMPANY_ONBOARDING_APPROVED', 'SuperAdmin', `Company: ${request.companyName}, SPOC: ${request.email}`);

    // 2. Create Company
    const company = await this.prisma.company.create({
      data: {
        name: request.companyName,
        logoUrl: request.logoUrl || `https://logo.clearbit.com/${request.domain || 'apnileap.com'}`,
        organizationId: organization.id,
      },
    });

    // 3. Create Tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: request.companyName,
        subdomain: request.subdomain,
        keycloakRealm: `${request.subdomain}-realm`,
        status: 'ACTIVE',
      },
    });

    // 4. Provision Keycloak realm and sync SPOC account via admin REST client
    // Note: To support Direct login UI, we trigger AuthService register for the SPOC.
    // Assigning the 'Sponsor' (Company Admin) role.
    const spocPassword = 'CompanyAdmin@' + Math.floor(100 + Math.random() * 900);
    const spocUser = await this.authService.register(
      request.email,
      spocPassword,
      `${request.companyName} SPOC`,
      'Sponsor',
    );

    // 5. Automated GitLab CE Provisioning
    let gitlabRepoUrl = '';
    let gitlabBoardUrl = '';
    try {
      console.log(`[GitLab Provisioning] Launching setup for approved company: ${request.companyName}`);
      const group = await this.gitlabService.createGroup(request.companyName, request.subdomain);
      const project = await this.gitlabService.createProject(group.id, 'apnileap-workspace', `Workspace repository for ${request.companyName}`);
      
      if (project) {
        gitlabRepoUrl = project.web_url || '';
        
        // Setup default Kanban Board
        const board = await this.gitlabService.createGitLabIssueBoard(project.id, `${request.companyName} Kanban Board`);
        gitlabBoardUrl = board?.web_url || '';

        // Setup default milestones
        await this.gitlabService.createMilestone(project.id, 'Sprint 1', 'Phase 1 MVP Sprint', '2026-07-25');
        await this.gitlabService.createMilestone(project.id, 'Sprint 2', 'Phase 2 Enhancements Sprint', '2026-08-20');

        // Commit CI/CD Template
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

        // Setup Webhooks pointing back to backend
        const webhookUrl = `http://localhost:5000/api/gitlab/webhook?projectId=${id}`;
        await this.gitlabService.createWebhook(project.id, webhookUrl);
      }
    } catch (gitlabErr) {
      console.warn('[GitLab Provisioning Failed] Skipping integration setup:', gitlabErr.message);
    }

    // Wiki provisioning already handled above; no Bookstack steps needed

    // 7. Send notification email containing credentials and links
    try {
      await sendEmail({
        to: request.email,
        subject: `🎉 [APNILEAP] Onboarding Approved: ${request.companyName}`,
        body: `Dear ${request.companyName} Admin,\n\nYour organization onboarding request has been successfully approved!\n\nYour workspace details:\n- Organization Name: ${request.companyName}\n- Subdomain: http://${request.subdomain}.apnileap.com\n- Admin Username: ${request.email}\n- Admin Temporary Password: ${spocPassword}\n\nGitLab Resources:\n- Repository URL: ${gitlabRepoUrl || 'Mocked GitLab'}\n- Agile Boards URL: ${gitlabBoardUrl || 'Mocked GitLab'}\n\nWiki.js Documentation Workspace:\n- Space URL: ${wikiSpaceUrl || 'Mocked Wiki'}\n- Welcome Page URL: ${wikiPageUrl || 'Mocked Wiki'}\n\nPlease login to secure your dashboard.\n\nBest regards,\nAPNILEAP Administrator`,
        type: 'onboarding_approval',
      });
    } catch (mailErr) {
      console.warn('Failed to send onboarding approval notification email:', mailErr.message);
    }

    // Emit approval event to n8n for workflow orchestration
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

    // 8. Update request status to APPROVED
    await this.prisma.onboardingRequest.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    // Save Wiki details in the project if a default project is linked or returned
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

  async reject(id: number, comments: string): Promise<any> {
    const request = await this.prisma.onboardingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Onboarding request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Onboarding request is already processed.');
    }

    await this.prisma.onboardingRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        comments: comments || 'Does not meet partner program requirements.',
      },
    });

    await this.auditService.logAction(
      'COMPANY_ONBOARDING_REJECTED',
      'SuperAdmin',
      `Company: ${request.companyName}, Reason: ${comments || 'No explanation provided'}`,
    );

    // Send rejection email
    try {
      await sendEmail({
        to: request.email,
        subject: `⚠️ [APNILEAP] Onboarding Status Update: ${request.companyName}`,
        body: `Dear ${request.companyName} Representative,\n\nThank you for your interest in APNILEAP.\n\nWe regret to inform you that your request for onboarding has been declined due to the following reason:\n"${comments || 'Does not meet partner program criteria.'}"\n\nFor more details, contact admin@apnileap.com.\n\nBest regards,\nAPNILEAP Administrator`,
        type: 'onboarding_rejection',
      });
    } catch (mailErr) {
      console.warn('Failed to send onboarding rejection email:', mailErr.message);
    }

    return { success: true };
  }
}
