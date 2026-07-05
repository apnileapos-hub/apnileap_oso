import { PrismaService } from '../prisma/prisma.service';
import { GitlabService } from '../gitlab/gitlab.service';
import { AuditService } from '../audit/audit.service';
export declare class TasksService {
    private readonly prisma;
    private readonly gitlabService;
    private readonly auditService;
    constructor(prisma: PrismaService, gitlabService: GitlabService, auditService: AuditService);
    private readonly SPOKES;
    private readonly CAMPUS_LABELS;
    private readonly MOCK_ASSIGNEES;
    getTasks(boardId?: string): Promise<any[]>;
    createTask(body: any, actorName?: string): Promise<any>;
    updateTask(key: string, body: any): Promise<any>;
    transitionTask(key: string, status: string): Promise<any>;
    deleteTask(key: string): Promise<any>;
    flagTask(key: string, flagged: boolean): Promise<any>;
    updateLabels(key: string, labels: string[]): Promise<any>;
    postWorklog(key: string, body: any): Promise<any>;
    getWorklogs(key: string): Promise<any[]>;
    createSubtask(key: string, body: any): Promise<any>;
    sendReminder(body: any): Promise<any>;
}
