import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(action: string, actor: string, details?: string): Promise<any> {
    try {
      return await this.prisma.auditLog.create({
        data: {
          action,
          actor,
          details: details || '',
        },
      });
    } catch (err) {
      console.warn('[Audit Log Failed] Bypassed saving activity:', err.message);
    }
  }

  async getLogs(limit: number = 50): Promise<any[]> {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
  }
}
