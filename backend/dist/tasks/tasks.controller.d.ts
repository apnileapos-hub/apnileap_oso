import { TasksService } from './tasks.service';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    getTasks(boardId?: string): Promise<any[]>;
    createTask(body: any, req: any): Promise<any>;
    updateTask(key: string, body: any): Promise<any>;
    transitionTask(key: string, body: any): Promise<any>;
    deleteTask(key: string): Promise<any>;
    flagTask(key: string, body: any): Promise<any>;
    updateLabels(key: string, body: any): Promise<any>;
    postWorklog(key: string, body: any): Promise<any>;
    getWorklogs(key: string): Promise<any[]>;
    createSubtask(key: string, body: any): Promise<any>;
    linkIssues(): Promise<{
        success: boolean;
        message: string;
    }>;
    sendReminder(body: any): Promise<any>;
}
