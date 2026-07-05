import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api')
@UseGuards(AuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Organizations Endpoints
  // ==========================================

  @Get('organizations')
  @Roles('Super Admin')
  async getOrganizations(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Post('organizations')
  @Roles('Super Admin')
  async createOrganization(@Body() body: { name: string; domain?: string }) {
    return this.prisma.organization.create({
      data: {
        name: body.name,
        domain: body.domain,
      },
    });
  }

  @Put('organizations/:id')
  @Roles('Super Admin')
  async updateOrganization(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; domain?: string },
  ) {
    return this.prisma.organization.update({
      where: { id },
      data: body,
    });
  }

  @Delete('organizations/:id')
  @Roles('Super Admin')
  async deleteOrganization(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.organization.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================
  // Companies Endpoints
  // ==========================================

  @Get('companies')
  async getCompanies(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
    @Query('organizationId') orgId?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (orgId) {
      where.organizationId = parseInt(orgId) || undefined;
    }

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limitNum,
        include: { organization: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Post('companies')
  @Roles('Super Admin', 'Company Admin')
  async createCompany(@Body() body: { name: string; logoUrl?: string; organizationId?: number }) {
    return this.prisma.company.create({
      data: {
        name: body.name,
        logoUrl: body.logoUrl,
        organizationId: body.organizationId,
      },
    });
  }

  @Put('companies/:id')
  @Roles('Super Admin', 'Company Admin')
  async updateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; logoUrl?: string; organizationId?: number },
  ) {
    return this.prisma.company.update({
      where: { id },
      data: body,
    });
  }

  @Delete('companies/:id')
  @Roles('Super Admin')
  async deleteCompany(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================
  // Colleges Endpoints
  // ==========================================

  @Get('colleges')
  async getColleges(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
    @Query('organizationId') orgId?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (orgId) {
      where.organizationId = parseInt(orgId) || undefined;
    }

    const [items, total] = await Promise.all([
      this.prisma.college.findMany({
        where,
        skip,
        take: limitNum,
        include: { organization: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.college.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Post('colleges')
  @Roles('Super Admin', 'College Admin')
  async createCollege(@Body() body: { name: string; universityId?: number; organizationId?: number }) {
    return this.prisma.college.create({
      data: {
        name: body.name,
        universityId: body.universityId,
        organizationId: body.organizationId,
      },
    });
  }

  @Put('colleges/:id')
  @Roles('Super Admin', 'College Admin')
  async updateCollege(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; universityId?: number; organizationId?: number },
  ) {
    return this.prisma.college.update({
      where: { id },
      data: body,
    });
  }

  @Delete('colleges/:id')
  @Roles('Super Admin')
  async deleteCollege(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.college.delete({ where: { id } });
    return { success: true };
  }

  // ==========================================
  // Departments Endpoints
  // ==========================================

  @Get('departments')
  async getDepartments(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
    @Query('collegeId') collegeId?: string,
    @Query('companyId') companyId?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (collegeId) {
      where.collegeId = parseInt(collegeId) || undefined;
    }
    if (companyId) {
      where.companyId = parseInt(companyId) || undefined;
    }

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: limitNum,
        include: { college: true, company: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Post('departments')
  @Roles('Super Admin', 'College Admin', 'Company Admin')
  async createDepartment(@Body() body: { name: string; collegeId?: number; companyId?: number }) {
    return this.prisma.department.create({
      data: {
        name: body.name,
        collegeId: body.collegeId,
        companyId: body.companyId,
      },
    });
  }

  @Put('departments/:id')
  @Roles('Super Admin', 'College Admin', 'Company Admin')
  async updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; collegeId?: number; companyId?: number },
  ) {
    return this.prisma.department.update({
      where: { id },
      data: body,
    });
  }

  @Delete('departments/:id')
  @Roles('Super Admin')
  async deleteDepartment(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.department.delete({ where: { id } });
    return { success: true };
  }
}
