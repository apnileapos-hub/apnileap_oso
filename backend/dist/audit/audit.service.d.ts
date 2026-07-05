import { PrismaService } from '../prisma/prisma.service';
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    logAction(action: string, actor: string, details?: string): Promise<any>;
    getLogs(limit?: number): Promise<any[]>;
}
