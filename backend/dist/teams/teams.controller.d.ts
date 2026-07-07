import { PrismaService } from '../prisma/prisma.service';
export declare class TeamsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getTeams(boardId?: string): Promise<{
        name: string;
        projectId: number | null;
        id: string;
        collegeId: string | null;
        members: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    createTeam(body: {
        name: string;
        members?: any;
        boardId?: string;
    }): Promise<{
        success: boolean;
        id: string;
        name: string;
        members: import("@prisma/client/runtime/library").JsonValue;
    }>;
    deleteTeam(id: string): Promise<{
        success: boolean;
    }>;
    allocateTeamToProject(projectIdStr: string, body: {
        name: string;
    }): Promise<{
        success: boolean;
        teamId: string;
        name: string;
    }>;
}
