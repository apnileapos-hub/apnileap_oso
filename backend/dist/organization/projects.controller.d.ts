import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
export declare class ProjectsController {
    private readonly prisma;
    private readonly tasksService;
    constructor(prisma: PrismaService, tasksService: TasksService);
    getProjects(): Promise<{
        description: string | null;
        id: number;
        createdAt: Date;
        companyId: number | null;
        status: string;
        title: string;
        teamId: string | null;
        spokeId: string | null;
        budget: import("@prisma/client/runtime/library").Decimal | null;
        durationWeeks: number | null;
        epics: import("@prisma/client/runtime/library").JsonValue | null;
        confluenceSpaceUrl: string | null;
        jiraBoardUrl: string | null;
        jiraProjectKey: string | null;
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
            description: string | null;
            id: number;
            createdAt: Date;
            companyId: number | null;
            status: string;
            title: string;
            teamId: string | null;
            spokeId: string | null;
            budget: import("@prisma/client/runtime/library").Decimal | null;
            durationWeeks: number | null;
            epics: import("@prisma/client/runtime/library").JsonValue | null;
            confluenceSpaceUrl: string | null;
            jiraBoardUrl: string | null;
            jiraProjectKey: string | null;
        };
    }>;
    private realAiGeneratePhases;
    private mockAiGeneratePhases;
}
