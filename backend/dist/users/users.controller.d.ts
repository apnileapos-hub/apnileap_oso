import { PrismaService } from '../prisma/prisma.service';
export declare class UsersController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMyself(): Promise<{
        accountId: string;
        displayName: string;
        emailAddress: string;
        avatarUrls: {
            '48x48': string;
        };
        active: boolean;
        timeZone: string;
    }>;
    getUsers(page?: string, limit?: string, search?: string, role?: string, collegeId?: string): Promise<{
        items: {
            id: number;
            name: string;
            email: string;
            role: string;
            password: string;
            collegeId: string | null;
            departmentId: number | null;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getSpokeMembers(boardId: string): Promise<{
        accountId: string;
        displayName: string;
        emailAddress: string;
        role: string;
    }[]>;
    getCampusStudents(campusId: string): Promise<{
        id: number;
        name: string;
        email: string;
    }[]>;
}
