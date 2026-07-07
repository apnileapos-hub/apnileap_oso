import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
export declare class ProjectsController {
    private readonly prisma;
    private readonly tasksService;
    constructor(prisma: PrismaService, tasksService: TasksService);
    getProjects(): Promise<{
        id: number;
        title: string;
        description: string | null;
        status: string;
        teamId: string | null;
        spokeId: string | null;
        companyId: number | null;
        budget: import("@prisma/client/runtime/library").Decimal | null;
        durationWeeks: number | null;
        epics: import("@prisma/client/runtime/library").JsonValue | null;
        confluenceSpaceUrl: string | null;
        jiraBoardUrl: string | null;
        jiraProjectKey: string | null;
        createdAt: Date;
    }[]>;
    autoAssignProject(body: {
        projectId: number;
        targetBoardId: string;
        dueDate?: string;
    }): Promise<{
        success: boolean;
        assignedTo: string;
        tasksCreated: number;
    }>;
    createProject(body: any): Promise<{
        success: boolean;
        project: {
            id: number;
            title: string;
            description: string | null;
            status: string;
            teamId: string | null;
            spokeId: string | null;
            companyId: number | null;
            budget: import("@prisma/client/runtime/library").Decimal | null;
            durationWeeks: number | null;
            epics: import("@prisma/client/runtime/library").JsonValue | null;
            confluenceSpaceUrl: string | null;
            jiraBoardUrl: string | null;
            jiraProjectKey: string | null;
            createdAt: Date;
        };
    }>;
    private realAiGeneratePhases;
    private mockAiGeneratePhases;
}
