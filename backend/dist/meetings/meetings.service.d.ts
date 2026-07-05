import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class MeetingsService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private readonly SPOKES;
    private readonly CAMPUS_TEAM_MEMBERS;
    getMeetings(): Promise<any[]>;
    createMeeting(body: any, actor?: string): Promise<any>;
    getMeetingMessages(meetingId: string): Promise<any[]>;
    postMeetingMessage(meetingId: string, body: any, actor: string): Promise<any>;
    sendPrepReminder(id: string, actor: string): Promise<any>;
    deleteMeeting(id: string, actor: string): Promise<any>;
}
