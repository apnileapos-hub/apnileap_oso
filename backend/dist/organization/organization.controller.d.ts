import { PrismaService } from '../prisma/prisma.service';
export declare class OrganizationController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getOrganizations(page?: string, limit?: string, search?: string): Promise<{
        items: {
            id: number;
            createdAt: Date;
            name: string;
            domain: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    createOrganization(body: {
        name: string;
        domain?: string;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        domain: string | null;
    }>;
    updateOrganization(id: number, body: {
        name?: string;
        domain?: string;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        domain: string | null;
    }>;
    deleteOrganization(id: number): Promise<{
        success: boolean;
    }>;
    getCompanies(page?: string, limit?: string, search?: string, orgId?: string): Promise<{
        items: ({
            organization: {
                id: number;
                createdAt: Date;
                name: string;
                domain: string | null;
            };
        } & {
            id: number;
            createdAt: Date;
            name: string;
            logoUrl: string | null;
            organizationId: number | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    createCompany(body: {
        name: string;
        logoUrl?: string;
        organizationId?: number;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        logoUrl: string | null;
        organizationId: number | null;
    }>;
    updateCompany(id: number, body: {
        name?: string;
        logoUrl?: string;
        organizationId?: number;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        logoUrl: string | null;
        organizationId: number | null;
    }>;
    deleteCompany(id: number): Promise<{
        success: boolean;
    }>;
    getColleges(page?: string, limit?: string, search?: string, orgId?: string): Promise<{
        items: ({
            organization: {
                id: number;
                createdAt: Date;
                name: string;
                domain: string | null;
            };
        } & {
            id: number;
            createdAt: Date;
            name: string;
            organizationId: number | null;
            universityId: number | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    createCollege(body: {
        name: string;
        universityId?: number;
        organizationId?: number;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        organizationId: number | null;
        universityId: number | null;
    }>;
    updateCollege(id: number, body: {
        name?: string;
        universityId?: number;
        organizationId?: number;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        organizationId: number | null;
        universityId: number | null;
    }>;
    deleteCollege(id: number): Promise<{
        success: boolean;
    }>;
    getDepartments(page?: string, limit?: string, search?: string, collegeId?: string, companyId?: string): Promise<{
        items: ({
            company: {
                id: number;
                createdAt: Date;
                name: string;
                logoUrl: string | null;
                organizationId: number | null;
            };
            college: {
                id: number;
                createdAt: Date;
                name: string;
                organizationId: number | null;
                universityId: number | null;
            };
        } & {
            id: number;
            createdAt: Date;
            name: string;
            collegeId: number | null;
            companyId: number | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    createDepartment(body: {
        name: string;
        collegeId?: number;
        companyId?: number;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        collegeId: number | null;
        companyId: number | null;
    }>;
    updateDepartment(id: number, body: {
        name?: string;
        collegeId?: number;
        companyId?: number;
    }): Promise<{
        id: number;
        createdAt: Date;
        name: string;
        collegeId: number | null;
        companyId: number | null;
    }>;
    deleteDepartment(id: number): Promise<{
        success: boolean;
    }>;
}
