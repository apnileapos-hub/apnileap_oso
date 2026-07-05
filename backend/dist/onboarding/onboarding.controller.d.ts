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
        companyName: string;
        email: string;
        subdomain: string;
        domain: string | null;
        logoUrl: string | null;
        status: string;
        comments: string | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
    }>;
    getRequests(page?: string, limit?: string, search?: string, status?: string): Promise<{
        items: {
            companyName: string;
            email: string;
            subdomain: string;
            domain: string | null;
            logoUrl: string | null;
            status: string;
            comments: string | null;
            createdAt: Date;
            updatedAt: Date;
            id: number;
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
