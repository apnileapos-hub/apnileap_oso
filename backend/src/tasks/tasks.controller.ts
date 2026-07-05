import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async getTasks(@Query('boardId') boardId: string = '3') {
    return this.tasksService.getTasks(boardId);
  }

  @Post()
  async createTask(@Body() body: any, @Req() req: any) {
    const actorName = req.user?.name || 'Platform Automation';
    return this.tasksService.createTask(body, actorName);
  }

  @Put(':key')
  async updateTask(@Param('key') key: string, @Body() body: any) {
    return this.tasksService.updateTask(key, body);
  }

  @Post(':key/transition')
  async transitionTask(@Param('key') key: string, @Body() body: any) {
    const status = body.status || body.statusName;
    return this.tasksService.transitionTask(key, status);
  }

  @Delete(':key')
  async deleteTask(@Param('key') key: string) {
    return this.tasksService.deleteTask(key);
  }

  @Put(':key/flag')
  async flagTask(@Param('key') key: string, @Body() body: any) {
    return this.tasksService.flagTask(key, body.flagged);
  }

  @Put(':key/labels')
  async updateLabels(@Param('key') key: string, @Body() body: any) {
    return this.tasksService.updateLabels(key, body.labels || []);
  }

  @Post(':key/worklog')
  async postWorklog(@Param('key') key: string, @Body() body: any) {
    return this.tasksService.postWorklog(key, body);
  }

  @Get(':key/worklog')
  async getWorklogs(@Param('key') key: string) {
    return this.tasksService.getWorklogs(key);
  }

  @Post(':key/subtask')
  async createSubtask(@Param('key') key: string, @Body() body: any) {
    return this.tasksService.createSubtask(key, body);
  }

  @Post('links')
  async linkIssues() {
    return { success: true, message: 'Linked successfully' };
  }

  @Post('send-reminder')
  async sendReminder(@Body() body: any) {
    return this.tasksService.sendReminder(body);
  }
}
