import { PrismaService } from '../prisma/prisma.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { AuditService } from '../audit/audit.service';
export declare class SubmissionsController {
    private readonly prisma;
    private readonly gitlabService;
    private readonly auditService;
    constructor(prisma: PrismaService, gitlabService: GitlabService, auditService: AuditService);
    submitDeliverable(taskId: string, body: {
        studentName: string;
        fileName: string;
        fileUrl: string;
        comments?: string;
    }): Promise<{
        success: boolean;
        submission: {
            id: number;
            status: string;
            comments: string | null;
            fileName: string;
            taskId: string;
            studentName: string;
            fileUrl: string;
            feedback: string | null;
            submittedAt: Date;
        };
    }>;
    getTaskSubmissions(taskId: string): Promise<{
        id: number;
        status: string;
        comments: string | null;
        fileName: string;
        taskId: string;
        studentName: string;
        fileUrl: string;
        feedback: string | null;
        submittedAt: Date;
    }[]>;
    getAllSubmissions(): Promise<{
        id: number;
        status: string;
        comments: string | null;
        fileName: string;
        taskId: string;
        studentName: string;
        fileUrl: string;
        feedback: string | null;
        submittedAt: Date;
    }[]>;
    updateStatus(id: number, body: {
        status: string;
        feedback?: string;
    }): Promise<{
        success: boolean;
        submission: {
            id: number;
            status: string;
            comments: string | null;
            fileName: string;
            taskId: string;
            studentName: string;
            fileUrl: string;
            feedback: string | null;
            submittedAt: Date;
        };
    }>;
    deleteSubmission(id: number): Promise<{
        success: boolean;
    }>;
}
