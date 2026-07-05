import { PrismaService } from '../prisma/prisma.service';
export declare class GitlabController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    handleWebhook(body: any, queryProjectId?: string, gitlabEvent?: string): Promise<{
        success: boolean;
    }>;
    private handleIssueEvent;
    private handlePipelineEvent;
    private handlePushEvent;
    private handleMergeRequestEvent;
}
