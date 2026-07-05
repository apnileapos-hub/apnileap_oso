import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller()
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard-metrics')
  @UseGuards(AuthGuard)
  async getDashboardMetrics() {
    try {
      const tasks = await this.prisma.mockTask.findMany();
      const total = tasks.length;
      let open = 0;
      let inProgress = 0;
      let done = 0;
      let totalAgeDays = 0;
      const now = Date.now();

      tasks.forEach(t => {
        const fields = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
        const s = (fields?.status?.name || '').toLowerCase();
        
        if (s.includes('done') || s.includes('closed') || s.includes('resolved')) {
          done++;
        } else if (s.includes('progress') || s.includes('review') || s.includes('testing')) {
          inProgress++;
        } else {
          open++;
        }

        if (fields?.created) {
          totalAgeDays += (now - new Date(fields.created).getTime()) / (1000 * 60 * 60 * 24);
        }
      });

      const avgAgeDays = total > 0 ? Math.round(totalAgeDays / total) : 0;
      return { total, open, inProgress, done, avgAgeDays };
    } catch (err) {
      console.error('Error in /dashboard-metrics:', err.message);
      return { total: 0, open: 0, inProgress: 0, done: 0, avgAgeDays: 0 };
    }
  }

  @Get('hub/metrics')
  async getHubMetrics() {
    try {
      // 1. Fetch B2B projects from PostgreSQL
      const projects = await this.prisma.project.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      const b2bProjects: any[] = [];
      const SPOKES_MAP: { [key: string]: string } = {
        '3': 'KLE Spoke',
        '101': 'COEP Spoke',
        '102': 'MMCOEP Spoke',
        '103': 'RIT Spoke',
        'kle-spoke': 'KLE Spoke',
        'coep-spoke': 'COEP Spoke',
        'mmcoep-spoke': 'MMCOEP Spoke',
        'rit-spoke': 'RIT Spoke',
      };
      
      const getSpokeName = (id: string) => SPOKES_MAP[id] || id || 'Campus Spoke';
      const getSpokeId = (name: string) => {
        if (!name) return null;
        const n = name.toLowerCase();
        if (n.includes('mmcoep')) return '102';
        if (n.includes('kle')) return '3';
        if (n.includes('coep')) return '101';
        if (n.includes('rit')) return '103';
        return name;
      };

      for (const p of projects) {
        // Manually fetch company association
        const company = p.companyId ? await this.prisma.company.findUnique({ where: { id: p.companyId } }) : null;

        const budgetStr = p.budget ? `$${p.budget.toString()}` : '$0';
        const spokeName = getSpokeName(p.spokeId || '');
        const campusId = getSpokeId(p.spokeId || '');
        const statusFormatted =
          p.status === 'ACCEPTED' || p.status === 'IN_PROGRESS' || p.status === 'active'
            ? 'Active'
            : p.status === 'ALLOCATED' || p.status === 'proposed'
              ? 'Proposed'
              : 'Pending Assignment';

        let allocations: any[] = [];
        if (p.spokeId) {
          // Resolve college SPOCs
          const mentorUsers = await this.prisma.user.findMany({
            where: {
              collegeId: p.spokeId,
              role: 'College-SPOC',
            },
          });
          const mentorAssignments = mentorUsers.map(mu => ({ facultyId: mu.id }));

          // Resolve allocated teams
          const teams = await this.prisma.team.findMany({
            where: { projectId: p.id },
          });
          
          const mappedTeams = teams.map(t => {
            const membersArray = Array.isArray(t.members) ? (t.members as any[]) : [];
            return {
              id: t.id,
              name: t.name,
              studentAssignments: membersArray.map(mId => ({ studentId: parseInt(mId) || 0 })),
            };
          });

          allocations = [
            {
              id: p.id.toString(),
              targetCampusId: p.spokeId,
              assignedTo: spokeName,
              status: statusFormatted,
              proposedDueDate: '2026-08-25',
              assignedKey: p.jiraProjectKey || null,
              progressPercent: 75,
              doneTasks: 6,
              mentorAssignments,
              teams: mappedTeams,
            },
          ];
        }

        b2bProjects.push({
          id: `proj-${p.id}`,
          company: company?.name || 'NVIDIA',
          logoUrl: company?.logoUrl || 'https://logo.clearbit.com/nvidia.com?size=80',
          title: p.title,
          description: p.description || '',
          budget: budgetStr,
          duration: p.durationWeeks ? `${p.durationWeeks} Weeks` : '12 Weeks',
          status: statusFormatted,
          assignedTo: p.spokeId ? spokeName : null,
          targetCampusId: campusId,
          proposedDueDate: '2026-08-25',
          assignedKey: p.jiraProjectKey || null,
          dateAdded: p.createdAt.toISOString().split('T')[0],
          allocations,
        });
      }

      // 2. Fetch all spokes tasks to aggregate progress statistics
      const spokesList = [
        { id: '3', name: 'KLE Spoke', key: 'AK' },
        { id: '101', name: 'COEP Spoke', key: 'AK' },
        { id: '102', name: 'MMCOEP Spoke', key: 'AK' },
        { id: '103', name: 'RIT Spoke', key: 'AK' },
      ];

      const spokesMetrics: any[] = [];
      const blockers: any[] = [];

      for (const sp of spokesList) {
        const tasks = await this.prisma.mockTask.findMany({
          where: { boardId: sp.id },
        });

        const mockTasks = tasks.map(t => {
          const fields = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
          return {
            id: t.id,
            key: t.key,
            fields: {
              summary: fields.summary || '',
              status: { name: fields.status?.name || 'To Do' },
              priority: { name: fields.priority?.name || 'Medium' },
              issuetype: { name: fields.issuetype?.name || 'Task' },
              assignee: fields.assignee ? { displayName: fields.assignee.displayName } : null,
              flagged: fields.flagged || false,
            },
          };
        });

        let total = 0;
        let done = 0;
        let progress = 0;
        let backlog = 0;
        let blockersCount = 0;

        mockTasks.forEach(t => {
          const status = (t.fields.status?.name || 'To Do').toLowerCase();
          total++;
          if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
            done++;
          } else if (status.includes('progress') || status.includes('review') || status.includes('testing')) {
            progress++;
          } else {
            backlog++;
          }

          if (t.fields.flagged) {
            blockersCount++;
            blockers.push({
              id: t.id,
              key: t.key,
              summary: t.fields.summary,
              statusName: t.fields.status?.name || 'To Do',
              priority: t.fields.priority?.name || 'Medium',
              spokeName: sp.name,
              assignee: t.fields.assignee,
            });
          }
        });

        spokesMetrics.push({
          id: sp.id,
          name: sp.name,
          key: sp.key,
          total,
          done,
          progress,
          backlog,
          blockersCount,
          completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
        });
      }

      return {
        spokes: spokesMetrics,
        workstreams: [],
        blockers,
        b2bProjects,
      };
    } catch (err) {
      console.error('Error in /hub/metrics:', err.message);
      return { spokes: [], workstreams: [], blockers: [], b2bProjects: [] };
    }
  }
}
