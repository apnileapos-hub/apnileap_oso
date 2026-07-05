import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller()
@UseGuards(AuthGuard)
export class TeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('api/teams')
  async getTeams(@Query('boardId') boardId?: string) {
    const spokeKey = boardId === '3' ? 'kle-spoke' : (boardId === '101' ? 'coep-spoke' : (boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));
    
    if (boardId) {
      return this.prisma.team.findMany({
        where: { collegeId: spokeKey },
      });
    }
    return this.prisma.team.findMany();
  }

  @Post('api/teams')
  async createTeam(@Body() body: { name: string; members?: any; boardId?: string }) {
    const teamId = 'team-' + Date.now();
    const spokeKey = body.boardId === '3' ? 'kle-spoke' : (body.boardId === '101' ? 'coep-spoke' : (body.boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'));

    const team = await this.prisma.team.create({
      data: {
        id: teamId,
        name: body.name,
        members: body.members || [],
        collegeId: spokeKey,
      },
    });

    return { success: true, id: team.id, name: team.name, members: team.members };
  }

  @Delete('api/teams/:id')
  async deleteTeam(@Param('id') id: string) {
    await this.prisma.team.delete({ where: { id } });
    return { success: true };
  }

  @Post('allocations/:id/teams')
  async allocateTeamToProject(@Param('id') projectIdStr: string, @Body() body: { name: string }) {
    const projectId = parseInt(projectIdStr);
    const teamId = 'team-' + Date.now() + Math.random().toString(36).substr(2, 5);

    // Find project spoke_id
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    const spokeId = project ? project.spokeId : null;

    const team = await this.prisma.team.create({
      data: {
        id: teamId,
        name: body.name,
        members: [],
        collegeId: spokeId,
      },
    });

    // Update project with team association
    if (project) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { teamId: team.id },
      });
    }

    return { success: true, teamId: team.id, name: team.name };
  }
}
