import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    login(email: string, password: string): Promise<any>;
    register(email: string, password: string, displayName: string, role: string): Promise<any>;
    refreshToken(refreshToken: string): Promise<any>;
}
