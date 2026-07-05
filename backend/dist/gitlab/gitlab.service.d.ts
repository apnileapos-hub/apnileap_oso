export declare class GitlabService {
    private getBaseUrl;
    private getToken;
    private getParentGroupId;
    private getHeaders;
    private hasGitLab;
    checkHealth(): Promise<boolean>;
    createGroup(name: string, pathName: string): Promise<any>;
    createProject(namespaceId: number, name: string, description?: string): Promise<any>;
    ensureGitLabLabels(projectId: number): Promise<void>;
    createGitLabIssueBoard(projectId: number, boardName: string): Promise<any>;
    createIssue(projectId: number, summary: string, description?: string, labels?: string[], assigneeIds?: number[]): Promise<any>;
    linkIssues(projectId: number, parentIssueIid: number, childIssueIid: number): Promise<boolean>;
    transitionIssue(projectId: number, issueIid: number, newStatus: string): Promise<boolean>;
    createIssueNote(projectId: number, issueIid: number, body: string): Promise<any>;
    getIssueNotes(projectId: number, issueIid: number): Promise<any[]>;
    commitCIYaml(projectId: number, content: string, commitMessage?: string): Promise<boolean>;
    createWebhook(projectId: number, webhookUrl: string): Promise<any>;
    createMilestone(projectId: number, title: string, description?: string, dueDate?: string): Promise<any>;
}
