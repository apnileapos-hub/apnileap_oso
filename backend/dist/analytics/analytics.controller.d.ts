import { PrismaService } from '../prisma/prisma.service';
export declare class AnalyticsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDashboardMetrics(): Promise<{
        total: number;
        open: number;
        inProgress: number;
        done: number;
        avgAgeDays: number;
    }>;
    getHubMetrics(): Promise<{
        spokes: any[];
        workstreams: any[];
        blockers: any[];
        b2bProjects: any[];
    }>;
}
