import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('api/audit-logs')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getLogs(@Query('limit') limit: string = '50') {
    const limitNum = parseInt(limit) || 50;
    return this.auditService.getLogs(limitNum);
  }
}
