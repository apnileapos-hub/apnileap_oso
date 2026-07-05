import { Controller, Post, Body, Query, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/gitlab')
export class GitlabController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Query('projectId') queryProjectId?: string,
    @Headers('x-gitlab-event') gitlabEvent?: string,
  ) {
    console.log(`📥 [GitLab Webhook] Received event type: "${gitlabEvent || body.object_kind}"`);

    const objectKind = body.object_kind || (gitlabEvent ? gitlabEvent.toLowerCase().replace(' hook', '') : '');

    try {
      if (objectKind === 'issue') {
        await this.handleIssueEvent(body);
      } else if (objectKind === 'pipeline') {
        this.handlePipelineEvent(body);
      } else if (objectKind === 'push') {
        this.handlePushEvent(body);
      } else if (objectKind === 'merge_request') {
        this.handleMergeRequestEvent(body);
      }
    } catch (err) {
      console.error('[GitLab Webhook] Process error:', err.message);
    }

    return { success: true };
  }

  private async handleIssueEvent(body: any) {
    const issueAttr = body.object_attributes;
    if (!issueAttr) return;

    const gitlabIssueId = issueAttr.id.toString();
    const issueIid = issueAttr.iid;
    const labels = body.labels || [];
    const labelNames = labels.map((l: any) => l.title);

    console.log(`[Issue Event] Issue #${issueIid} ("${issueAttr.title}") | Labels: [${labelNames.join(', ')}]`);

    // Map labels to task status
    let status = 'To Do';
    if (labelNames.includes('Done')) status = 'Done';
    else if (labelNames.includes('Testing')) status = 'Testing';
    else if (labelNames.includes('In Review')) status = 'In Review';
    else if (labelNames.includes('In Progress')) status = 'In Progress';

    // Find the task in local PostgreSQL database and update
    const task = await this.prisma.mockTask.findFirst({
      where: {
        OR: [
          { id: gitlabIssueId },
          { key: { endsWith: `-${issueIid}` } },
        ],
      },
    });

    if (task) {
      const currentFields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
      const updatedFields = {
        ...currentFields,
        status: { name: status },
      };

      await this.prisma.mockTask.update({
        where: { id: task.id },
        data: {
          fields: updatedFields,
        },
      });
      console.log(`[Database Sync] Updated task key ${task.key} status $\\rightarrow$ "${status}"`);
    } else {
      console.warn(`[Database Sync] Task matching GitLab issue ID ${gitlabIssueId} or #${issueIid} not found in DB.`);
    }
  }

  private handlePipelineEvent(body: any) {
    const pipelineAttr = body.object_attributes;
    if (!pipelineAttr) return;

    console.log(`🚀 [CI/CD Pipeline] Runner Status: "${pipelineAttr.status.toUpperCase()}" | ID: ${pipelineAttr.id} | Ref: ${pipelineAttr.ref} | Duration: ${pipelineAttr.duration || 0}s`);
  }

  private handlePushEvent(body: any) {
    const commits = body.commits || [];
    console.log(`💻 [Push Commit] User "${body.user_name}" pushed ${commits.length} commit(s) to branch "${body.ref}"`);
    commits.forEach((c: any) => {
      console.log(`  - [${c.id.slice(0, 8)}] "${c.message.trim()}"`);
    });
  }

  private handleMergeRequestEvent(body: any) {
    const mrAttr = body.object_attributes;
    if (!mrAttr) return;

    console.log(`🔀 [Merge Request] #${mrAttr.iid} "${mrAttr.title}" | State: "${mrAttr.state.toUpperCase()}" | Action: "${mrAttr.action}"`);
  }
}
