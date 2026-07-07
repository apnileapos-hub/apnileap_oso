import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sendEmail } from '../../legacy-express/emailService';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private readonly SPOKES = {
    '3': { name: 'KLE Hub', key: 'AK', boardId: 75 },
    '101': { name: 'COEP Hub', key: 'AK', boardId: 76 },
    '102': { name: 'MMCOEP Hub', key: 'AK', boardId: 77 },
    '103': { name: 'RIT Hub', key: 'AK', boardId: 78 },
  };

  private readonly CAMPUS_TEAM_MEMBERS = {
    '3': [
      { accountId: 'mock-kle-1', displayName: 'Rahul Sharma (Student Developer)', emailAddress: 'rahul@kle.edu', email: 'rahul@kle.edu' },
      { accountId: 'mock-kle-2', displayName: 'Priya Patel (Student Developer)', emailAddress: 'priya@kle.edu', email: 'priya@kle.edu' },
      { accountId: 'mock-kle-3', displayName: 'Prof. Deshpande (Faculty Mentor)', emailAddress: 'mentor@kle.edu', email: 'mentor@kle.edu' },
    ],
    '101': [
      { accountId: 'mock-coep-1', displayName: 'Sneha Joshi (Student Developer)', emailAddress: 'sneha@coep.edu', email: 'sneha@coep.edu' },
      { accountId: 'mock-coep-2', displayName: 'Amit Waghmare (Student Developer)', emailAddress: 'amit@coep.edu', email: 'amit@coep.edu' },
    ],
    '102': [
      { accountId: 'mock-mmcoep-1', displayName: 'Nikhil Rane (Student Developer)', emailAddress: 'nikhil@mmcoep.edu', email: 'nikhil@mmcoep.edu' },
      { accountId: 'mock-mmcoep-2', displayName: 'Sayali Deshmukh (Student Developer)', emailAddress: 'sayali@mmcoep.edu', email: 'sayali@mmcoep.edu' },
    ],
    '103': [
      { accountId: 'mock-rit-1', displayName: 'Tejas Shinde (Student Developer)', emailAddress: 'tejas@rit.edu', email: 'tejas@rit.edu' },
      { accountId: 'mock-rit-2', displayName: 'Priti Patil (Student Developer)', emailAddress: 'priti@rit.edu', email: 'priti@rit.edu' },
    ],
  };

  async getMeetings(): Promise<any[]> {
    const list = await this.prisma.meeting.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return list.map(m => ({
      id: m.id,
      title: m.title,
      campusId: m.campusId,
      date: m.date,
      time: m.time,
      link: m.link,
      agenda: m.agenda,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async createMeeting(body: any, actor: string = 'Scheduler'): Promise<any> {
    if (!body.title || !body.campusId || !body.date || !body.time) {
      throw new BadRequestException('Missing required title, campusId, date, or time');
    }

    const id = body.id || `meet-${Date.now()}`;
    const meetLink = body.link || 'https://teams.microsoft.com/';
    const meetAgenda = body.agenda || 'General campus sync.';

    const meeting = await this.prisma.meeting.upsert({
      where: { id },
      create: {
        id,
        title: body.title,
        campusId: body.campusId,
        date: body.date,
        time: body.time,
        link: meetLink,
        agenda: meetAgenda,
      },
      update: {
        title: body.title,
        campusId: body.campusId,
        date: body.date,
        time: body.time,
        link: meetLink,
        agenda: meetAgenda,
      },
    });

    await this.auditService.logAction('MEETING_SCHEDULED', actor, `Meeting ID: ${id}, Spoke ID: ${body.campusId}`);

    return { success: true, meeting };
  }

  async getMeetingMessages(meetingId: string): Promise<any[]> {
    return this.prisma.meetingMessage.findMany({
      where: { meetingId },
      orderBy: { timestamp: 'asc' },
    });
  }

  async postMeetingMessage(meetingId: string, body: any, actor: string): Promise<any> {
    if (!body.text) {
      throw new BadRequestException('Message text is required');
    }

    const msg = await this.prisma.meetingMessage.create({
      data: {
        meetingId,
        sender: body.sender || actor,
        text: body.text,
        issueKey: body.issueKey || null,
      },
    });

    return msg;
  }

  async sendPrepReminder(id: string, actor: string): Promise<any> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
      throw new NotFoundException('Sync meeting not found');
    }

    const spoke = this.SPOKES[meeting.campusId];
    if (!spoke) {
      throw new BadRequestException('Invalid campus hub associated with meeting');
    }

    // Query active sprint tasks to search for overdue/blocked items
    const tasks = await this.prisma.mockTask.findMany({
      where: { boardId: meeting.campusId },
    });

    const overdueTasks: any[] = [];
    const blockedTasks: any[] = [];
    const notifyCoordinators = new Set<string>(['manasa@apnileap.com', 'coordinator@' + spoke.key.toLowerCase() + '.edu']);

    // Resolve campus members
    const simulated = this.CAMPUS_TEAM_MEMBERS[meeting.campusId] || [];
    simulated.forEach(u => {
      const email = u.emailAddress || u.email;
      if (email) notifyCoordinators.add(email.toLowerCase().trim());
    });

    tasks.forEach(t => {
      const fields = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
      const issueType = fields.issuetype?.name || fields.issueType || 'Task';
      if (issueType === 'Epic') return;

      const summary = fields.summary || 'Sprint task';
      const status = fields.status?.name || fields.status || 'Backlog';
      const assigneeName = fields.assignee?.displayName || 'Unassigned';
      const assigneeEmail = fields.assignee?.emailAddress || fields.assignee?.email || null;

      if (assigneeEmail) {
        notifyCoordinators.add(assigneeEmail);
      }

      // Check if flagged
      const isFlagged = fields.flagged === true || 
                        (fields.Flagged && fields.Flagged.length > 0) ||
                        (fields.customfield_10021 && fields.customfield_10021.length > 0);

      if (isFlagged) {
        blockedTasks.push({ key: t.key || t.id, summary, status, assignee: assigneeName });
      }

      // Check if overdue
      const dueDateStr = fields.duedate || fields.dueDate || null;
      if (status !== 'Done' && dueDateStr) {
        const today = new Date('2026-05-27');
        const due = new Date(dueDateStr);
        if (due.getTime() < today.getTime()) {
          overdueTasks.push({ key: t.key || t.id, summary, dueDate: dueDateStr, assignee: assigneeName });
        }
      }
    });

    const recipientList = Array.from(notifyCoordinators);
    const redirectEmail = process.env.SMTP_REDIRECT_TO || null;
    const finalTo = redirectEmail ? redirectEmail : recipientList.join(', ');

    const redirectBannerHtml = redirectEmail ? `
      <div style="background: rgba(251, 146, 60, 0.08); border: 1px dashed rgba(251, 146, 60, 0.25); border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #fb923c; text-align: center; line-height: 1.5;">
        ⚙️ <strong>[Demo Rerouting Mode Active]</strong><br/>
        This email was originally addressed to: <span style="font-family: monospace; font-weight: 750; color: #f97316;">${recipientList.join(', ')}</span>.<br/>
        It has been rerouted to your administrator address (<strong style="color: white;">${redirectEmail}</strong>) for live verification.
      </div>
    ` : '';

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #07090e; padding: 40px; color: #f3f4f6; min-height: 100%;">
        <div style="max-width: 650px; margin: 0 auto; background: rgba(17, 24, 39, 0.9); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: white;">ApniLeap Hub</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #e0e7ff;">🏫 Campus Sync Invitation & Warning Digest</p>
          </div>
          
          <div style="padding: 40px 30px; line-height: 1.6;">
            ${redirectBannerHtml}
            <h2 style="margin-top: 0; color: white; font-size: 18px; font-weight: 700;">Campus Sync & Deliverables Warning</h2>
            <p style="font-size: 14px; color: #9ca3af; margin-bottom: 24px;">
              A campus sync meeting is scheduled for <strong style="color: #6366f1;">${spoke.name}</strong>. Please review the agenda and the current active sprint blockers/overdue items compiled for your spoke.
            </p>

            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: white;">📅 Meeting Details</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-weight: 600; width: 100px;">Title:</td>
                  <td style="padding: 4px 0; color: #f3f4f6; font-weight: 700;">${meeting.title}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Time:</td>
                  <td style="padding: 4px 0; color: #6366f1; font-weight: 700;">${meeting.date} at ${meeting.time}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Agenda:</td>
                  <td style="padding: 4px 0; color: #9ca3af;">${meeting.agenda}</td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 24px;">
              <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #f43f5e;">
                🚨 Active Campus Blockers (${blockedTasks.length})
              </h3>
              ${blockedTasks.length === 0 ? `
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; text-align: center; color: #10b981; font-size: 13px;">
                  None! Excellent team progression.
                </div>
              ` : `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <th style="padding: 10px; color: #9ca3af;">Key</th>
                      <th style="padding: 10px; color: #9ca3af;">Summary</th>
                      <th style="padding: 10px; color: #9ca3af;">Status</th>
                      <th style="padding: 10px; color: #9ca3af;">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${blockedTasks.map(t => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <td style="padding: 10px; font-family: monospace; color: #6366f1; font-weight: 700;">${t.key}</td>
                        <td style="padding: 10px; color: #f3f4f6; font-weight: 600;">${t.summary}</td>
                        <td style="padding: 10px;"><span style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">${t.status}</span></td>
                        <td style="padding: 10px; color: #9ca3af;">${t.assignee}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #fb923c;">
                ⏰ Overdue Deadlines (${overdueTasks.length})
              </h3>
              ${overdueTasks.length === 0 ? `
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; text-align: center; color: #10b981; font-size: 13px;">
                  None! All sprint tasks are currently on track.
                </div>
              ` : `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <th style="padding: 10px; color: #9ca3af;">Key</th>
                      <th style="padding: 10px; color: #9ca3af;">Summary</th>
                      <th style="padding: 10px; color: #9ca3af;">Due Date</th>
                      <th style="padding: 10px; color: #9ca3af;">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${overdueTasks.map(t => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <td style="padding: 10px; font-family: monospace; color: #6366f1; font-weight: 700;">${t.key}</td>
                        <td style="padding: 10px; color: #f3f4f6; font-weight: 600;">${t.summary}</td>
                        <td style="padding: 10px; color: #fb923c; font-weight: 700;">⏰ ${t.dueDate}</td>
                        <td style="padding: 10px; color: #9ca3af;">${t.assignee}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <div style="text-align: center;">
              <a href="${meeting.link}" target="_blank" style="background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);">
                Join Live Sync Room
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    const textBody = `Meeting: ${meeting.title}\nCampus Hub: ${spoke.name}\nTime: ${meeting.date} at ${meeting.time}\n\nOverdue Tasks: ${overdueTasks.length}\nBlocked Tasks: ${blockedTasks.length}`;

    const info = await sendEmail({
      to: finalTo,
      subject: `🚨 [Warning Digest] Campus Sync Prep: ${meeting.title} (${spoke.name})`,
      body: textBody,
      html: htmlTemplate,
      type: 'warning',
    });

    await this.auditService.logAction('MEETING_REMINDER_SENT', actor, `Meeting ID: ${id}, Overdue: ${overdueTasks.length}, Blocked: ${blockedTasks.length}`);

    return {
      success: true,
      message: `Pre-meeting alerts successfully dispatched to coordinators!`,
      notifiedEmails: recipientList,
      overdueCount: overdueTasks.length,
      blockerCount: blockedTasks.length,
      emailId: info.id,
    };
  }

  async deleteMeeting(id: string, actor: string): Promise<any> {
    await this.prisma.meeting.delete({ where: { id } });
    await this.auditService.logAction('MEETING_DELETED', actor, `Meeting ID: ${id}`);
    return { success: true };
  }
}
