import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, NotFoundException, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { GitlabService } from '../gitlab/gitlab.service';
import { AuditService } from '../audit/audit.service';

@Controller()
@UseGuards(AuthGuard)
export class SubmissionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gitlabService: GitlabService,
    private readonly auditService: AuditService,
  ) {}

  @Post('tasks/:taskId/submit')
  async submitDeliverable(
    @Param('taskId') taskId: string,
    @Body() body: { studentName: string; fileName: string; fileUrl: string; comments?: string },
  ) {
    if (!body.studentName || !body.fileName || !body.fileUrl) {
      throw new BadRequestException('Missing studentName, fileName, or fileUrl');
    }

    const submission = await this.prisma.submission.create({
      data: {
        taskId,
        studentName: body.studentName,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        comments: body.comments || '',
        status: 'Pending Review',
        feedback: '',
      },
    });

    await this.auditService.logAction(
      'DELIVERABLE_SUBMITTED',
      body.studentName,
      `Task: ${taskId}, File: ${body.fileName}`,
    );

    return { success: true, submission };
  }

  @Get('tasks/:taskId/submissions')
  async getTaskSubmissions(@Param('taskId') taskId: string) {
    return this.prisma.submission.findMany({
      where: { taskId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  @Get('submissions')
  async getAllSubmissions() {
    return this.prisma.submission.findMany({
      orderBy: { submittedAt: 'desc' },
    });
  }

  @Put('submissions/:id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; feedback?: string },
  ) {
    if (!body.status || !['Approved', 'Re-work Requested'].includes(body.status)) {
      throw new BadRequestException("Status must be 'Approved' or 'Re-work Requested'");
    }

    const submission = await this.prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission record not found');
    }

    const updatedSub = await this.prisma.submission.update({
      where: { id },
      data: {
        status: body.status,
        feedback: body.feedback || '',
      },
    });

    await this.auditService.logAction(
      'DELIVERABLE_REVIEWED',
      'Mentor',
      `Submission ID: ${id}, Task: ${submission.taskId}, Decision: ${body.status}`,
    );

    // Reactive automation: transition task status automatically!
    try {
      const taskId = submission.taskId;
      const targetStatus = body.status === 'Approved' ? 'Done' : 'In Progress';

      const task = await this.prisma.mockTask.findFirst({
        where: {
          OR: [
            { id: taskId },
            { key: taskId },
          ],
        },
      });

      if (task) {
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
        fields.status = { name: targetStatus };

        if (body.status === 'Re-work Requested') {
          fields.flagged = true;
          fields.description = `${fields.description || ''}\n\n⚠️ [MENTOR FEEDBACK]: ${body.feedback}`;
        } else {
          fields.flagged = false;
        }

        await this.prisma.mockTask.update({
          where: { id: task.id },
          data: { fields },
        });

        // Trigger GitLab Issue labels transition & note comments in background
        this.prisma.project.findFirst({
          where: { spokeId: task.boardId === '3' ? 'kle-spoke' : (task.boardId === '101' ? 'coep-spoke' : (task.boardId === '102' ? 'mmcoep-spoke' : 'rit-spoke')) },
        }).then(async (project) => {
          if (project && task.key.includes('-')) {
            const issueIid = parseInt(task.key.split('-')[1]);
            if (!isNaN(issueIid)) {
              await this.gitlabService.transitionIssue(project.id, issueIid, targetStatus);
              if (body.status === 'Re-work Requested') {
                await this.gitlabService.createIssueNote(project.id, issueIid, `⚠️ [RE-WORK REQUESTED BY COORDINATOR]:\n${body.feedback}`);
              }
            }
          }
        });
      }
    } catch (reactiveErr) {
      console.warn('[Reactive Automation Failed] Task transition bypassed:', reactiveErr.message);
    }

    return { success: true, submission: updatedSub };
  }

  @Delete('submissions/:id')
  async deleteSubmission(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.submission.delete({ where: { id } });
    return { success: true };
  }
}
