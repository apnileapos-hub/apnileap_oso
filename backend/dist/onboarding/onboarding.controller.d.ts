import { OnboardingService } from './onboarding.service';
export declare class OnboardingController {
    private readonly onboardingService;
    constructor(onboardingService: OnboardingService);
    register(body: {
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
    getRequests(page?: string, limit?: string, search?: string, status?: string): Promise<{
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
    reject(id: number, body: {
        comments?: string;
    }): Promise<any>;
}
