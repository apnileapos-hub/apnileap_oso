import { MeetingsService } from './meetings.service';
export declare class MeetingsController {
    private readonly meetingsService;
    constructor(meetingsService: MeetingsService);
    getMeetings(): Promise<any[]>;
    createMeeting(body: any, req: any): Promise<any>;
    getMessages(meetingId: string): Promise<any[]>;
    postMessage(meetingId: string, body: any, req: any): Promise<any>;
    sendReminder(id: string, req: any): Promise<any>;
    deleteMeeting(meetId: string, req: any): Promise<any>;
}
