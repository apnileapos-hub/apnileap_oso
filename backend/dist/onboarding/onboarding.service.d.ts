import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { WikiService } from '../wiki/wiki.service';
import { N8nService } from '../n8n/n8n.service';
import { AuditService } from '../audit/audit.service';
export declare class OnboardingService {
    private readonly prisma;
    private readonly authService;
    private readonly gitlabService;
    private readonly wikiService;
    private readonly n8nService;
    private readonly auditService;
    constructor(prisma: PrismaService, authService: AuthService, gitlabService: GitlabService, wikiService: WikiService, n8nService: N8nService, auditService: AuditService);
    register(data: {
        companyName: string;
        email: string;
        subdomain: string;
        domain?: string;
        logoUrl?: string;
    }): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        domain: string | null;
        logoUrl: string | null;
        status: string;
        subdomain: string;
        companyName: string;
        comments: string | null;
    }>;
    getRequests(pageNum?: number, limitNum?: number, search?: string, status?: string): Promise<{
        items: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            domain: string | null;
            logoUrl: string | null;
            status: string;
            subdomain: string;
            companyName: string;
            comments: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    approve(id: number): Promise<any>;
    reject(id: number, comments: string): Promise<any>;
}
