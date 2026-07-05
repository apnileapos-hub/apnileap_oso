import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('myself')
  async getMyself() {
    return {
      accountId: 'admin-mock-id',
      displayName: 'apnileapos (Offline)',
      emailAddress: 'apnileapos@gmail.com',
      avatarUrls: {
        '48x48': 'https://i.pravatar.cc/150?img=68',
      },
      active: true,
      timeZone: 'Asia/Kolkata',
    };
  }

  @Get('api/users')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
    @Query('role') role?: string,
    @Query('collegeId') collegeId?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }
    if (collegeId) {
      where.collegeId = collegeId;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('spokes/:boardId/members')
  async getSpokeMembers(@Param('boardId') boardId: string) {
    const spokeKey = boardId === '3' ? 'kle-spoke' : (boardId === '101' ? 'coep-spoke' : (boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));
    
    const members = await this.prisma.user.findMany({
      where: { collegeId: spokeKey },
      select: {
        email: true,
        name: true,
        role: true,
      },
    });

    return members.map(m => ({
      accountId: m.email,
      displayName: m.name,
      emailAddress: m.email,
      role: m.role,
    }));
  }

  @Get('students/:campusId')
  async getCampusStudents(@Param('campusId') campusId: string) {
    const spokeKey = campusId === '3' ? 'kle-spoke' : (campusId === '101' ? 'coep-spoke' : (campusId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));
    
    return this.prisma.user.findMany({
      where: {
        collegeId: spokeKey,
        role: 'Student',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }
}
