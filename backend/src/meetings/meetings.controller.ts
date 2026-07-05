import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('api/meetings')
@UseGuards(AuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  async getMeetings() {
    return this.meetingsService.getMeetings();
  }

  @Post()
  async createMeeting(@Body() body: any, @Req() req: any) {
    const actor = req.user?.name || req.user?.email || 'System';
    return this.meetingsService.createMeeting(body, actor);
  }

  @Get(':meetingId/messages')
  async getMessages(@Param('meetingId') meetingId: string) {
    return this.meetingsService.getMeetingMessages(meetingId);
  }

  @Post(':meetingId/messages')
  async postMessage(@Param('meetingId') meetingId: string, @Body() body: any, @Req() req: any) {
    const actor = req.user?.name || req.user?.email || 'System';
    return this.meetingsService.postMeetingMessage(meetingId, body, actor);
  }

  @Post(':id/remind')
  async sendReminder(@Param('id') id: string, @Req() req: any) {
    const actor = req.user?.name || req.user?.email || 'System';
    return this.meetingsService.sendPrepReminder(id, actor);
  }

  @Delete(':meetId')
  async deleteMeeting(@Param('meetId') meetId: string, @Req() req: any) {
    const actor = req.user?.name || req.user?.email || 'System';
    return this.meetingsService.deleteMeeting(meetId, actor);
  }
}
