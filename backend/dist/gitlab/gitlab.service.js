"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitlabService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let GitlabService = class GitlabService {
    getBaseUrl() {
        return process.env.GITLAB_BASE_URL || 'http://localhost:8080';
    }
    getToken() {
        return process.env.GITLAB_TOKEN || '';
    }
    getParentGroupId() {
        return process.env.GITLAB_PARENT_GROUP_ID || '';
    }
    getHeaders() {
        return {
            'PRIVATE-TOKEN': this.getToken(),
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };
    }
    hasGitLab() {
        return !!this.getToken();
    }
    async checkHealth() {
        try {
            await axios_1.default.get(`${this.getBaseUrl()}/api/v4/version`, {
                headers: this.getHeaders(),
                timeout: 3000,
            });
            return true;
        }
        catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                return true;
            }
            return false;
        }
    }
    async createGroup(name, pathName) {
        if (!this.hasGitLab()) {
            return { id: 999 + Math.floor(Math.random() * 100), name, path: pathName, full_path: pathName };
        }
        const payload = {
            name,
            path: pathName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            visibility: 'private',
        };
        const parentId = this.getParentGroupId();
        if (parentId) {
            payload.parent_id = parseInt(parentId);
        }
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/v4/groups`, payload, {
                headers: this.getHeaders(),
                timeout: 10000,
            });
            return res.data;
        }
        catch (err) {
            if (err.response?.status === 400 && err.response?.data?.message?.path?.includes('has already been taken')) {
                try {
                    const fetchRes = await axios_1.default.get(`${this.getBaseUrl()}/api/v4/groups/${encodeURIComponent(payload.path)}`, {
                        headers: this.getHeaders(),
                    });
                    return fetchRes.data;
                }
                catch (fetchErr) {
                    console.error('[GitLab] Failed to fetch existing group:', fetchErr.message);
                }
            }
            return { id: 999, name, path: pathName, full_path: pathName };
        }
    }
    async createProject(namespaceId, name, description = '') {
        if (!this.hasGitLab()) {
            const cleanName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            return {
                id: 8888 + Math.floor(Math.random() * 100),
                name,
                path_with_namespace: `mock-group/${cleanName}`,
                web_url: `${this.getBaseUrl()}/mock-group/${cleanName}`,
            };
        }
        const payload = {
            name,
            description,
            visibility: 'private',
            namespace_id: namespaceId,
            initialize_with_readme: true,
        };
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects`, payload, {
                headers: this.getHeaders(),
                timeout: 10000,
            });
            return res.data;
        }
        catch (err) {
            if (err.response?.status === 400 && err.response?.data?.message?.name?.includes('has already been taken')) {
                try {
                    const searchRes = await axios_1.default.get(`${this.getBaseUrl()}/api/v4/groups/${namespaceId}/projects?search=${encodeURIComponent(name)}`, { headers: this.getHeaders() });
                    if (searchRes.data && searchRes.data.length > 0) {
                        return searchRes.data[0];
                    }
                }
                catch (searchErr) {
                    console.error('[GitLab] Failed to fetch existing project:', searchErr.message);
                }
            }
            const cleanName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            return { id: 8888, name, path_with_namespace: `mock-group/${cleanName}`, web_url: `${this.getBaseUrl()}/mock-group/${cleanName}` };
        }
    }
    async ensureGitLabLabels(projectId) {
        if (!this.hasGitLab())
            return;
        const defaultLabels = [
            { name: 'To Do', color: '#f59e0b' },
            { name: 'In Progress', color: '#3b82f6' },
            { name: 'In Review', color: '#8b5cf6' },
            { name: 'Testing', color: '#ec4899' },
            { name: 'Done', color: '#10b981' },
            { name: 'Epic', color: '#6b7280' },
        ];
        for (const label of defaultLabels) {
            try {
                await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/labels`, label, {
                    headers: this.getHeaders(),
                });
            }
            catch (err) {
                if (err.response?.status !== 409) {
                    console.warn(`[GitLab] Could not ensure label "${label.name}":`, err.message);
                }
            }
        }
    }
    async createGitLabIssueBoard(projectId, boardName) {
        if (!this.hasGitLab()) {
            return { id: 777, name: boardName, web_url: `${this.getBaseUrl()}/mock-project/boards` };
        }
        try {
            await this.ensureGitLabLabels(projectId);
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/boards`, { name: boardName }, { headers: this.getHeaders() });
            const board = res.data;
            const lists = ['To Do', 'In Progress', 'In Review', 'Testing', 'Done'];
            const labelRes = await axios_1.default.get(`${this.getBaseUrl()}/api/v4/projects/${projectId}/labels`, {
                headers: this.getHeaders(),
            });
            const labelsMap = labelRes.data || [];
            for (const labelName of lists) {
                const matchedLabel = labelsMap.find((l) => l.name === labelName);
                if (matchedLabel) {
                    try {
                        await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/boards/${board.id}/lists`, { label_id: matchedLabel.id }, { headers: this.getHeaders() });
                    }
                    catch (listErr) {
                    }
                }
            }
            return board;
        }
        catch (err) {
            return { id: 777, name: boardName, web_url: `${this.getBaseUrl()}/projects/${projectId}/boards` };
        }
    }
    async createIssue(projectId, summary, description = '', labels = [], assigneeIds = []) {
        if (!this.hasGitLab()) {
            const mockIid = 100 + Math.floor(Math.random() * 900);
            return {
                id: 66666 + mockIid,
                iid: mockIid,
                title: summary,
                description,
                labels,
                web_url: `${this.getBaseUrl()}/mock-project/issues/${mockIid}`,
            };
        }
        const payload = {
            title: summary,
            description,
            labels: labels.join(','),
            assignee_ids: assigneeIds,
        };
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/issues`, payload, {
                headers: this.getHeaders(),
            });
            return res.data;
        }
        catch (err) {
            const mockIid = 100 + Math.floor(Math.random() * 900);
            return { id: 66666, iid: mockIid, title: summary, description, labels, web_url: `${this.getBaseUrl()}/mock-project/issues/${mockIid}` };
        }
    }
    async linkIssues(projectId, parentIssueIid, childIssueIid) {
        if (!this.hasGitLab())
            return true;
        try {
            await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/issues/${parentIssueIid}/links`, { target_project_id: projectId, target_issue_iid: childIssueIid }, { headers: this.getHeaders() });
            return true;
        }
        catch (err) {
            return false;
        }
    }
    async transitionIssue(projectId, issueIid, newStatus) {
        if (!this.hasGitLab())
            return true;
        try {
            const getRes = await axios_1.default.get(`${this.getBaseUrl()}/api/v4/projects/${projectId}/issues/${issueIid}`, {
                headers: this.getHeaders(),
            });
            const currentLabels = getRes.data.labels || [];
            const statuses = ['To Do', 'In Progress', 'In Review', 'Testing', 'Done'];
            const normalizedNewStatus = statuses.find(s => s.toLowerCase() === newStatus.toLowerCase()) || 'To Do';
            const cleanLabels = currentLabels.filter((lbl) => !statuses.includes(lbl));
            cleanLabels.push(normalizedNewStatus);
            await axios_1.default.put(`${this.getBaseUrl()}/api/v4/projects/${projectId}/issues/${issueIid}`, { labels: cleanLabels.join(',') }, { headers: this.getHeaders() });
            return true;
        }
        catch (err) {
            return false;
        }
    }
    async createIssueNote(projectId, issueIid, body) {
        if (!this.hasGitLab()) {
            return { id: 5555, body, created_at: new Date().toISOString() };
        }
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/issues/${issueIid}/notes`, { body }, { headers: this.getHeaders() });
            return res.data;
        }
        catch (err) {
            return { id: 5555, body, created_at: new Date().toISOString() };
        }
    }
    async getIssueNotes(projectId, issueIid) {
        if (!this.hasGitLab())
            return [];
        try {
            const res = await axios_1.default.get(`${this.getBaseUrl()}/api/v4/projects/${projectId}/issues/${issueIid}/notes`, {
                headers: this.getHeaders(),
            });
            return res.data || [];
        }
        catch (err) {
            return [];
        }
    }
    async commitCIYaml(projectId, content, commitMessage = 'Add GitLab CI/CD configuration') {
        if (!this.hasGitLab())
            return true;
        try {
            const filePath = '.gitlab-ci.yml';
            const payload = {
                branch: 'main',
                commit_message: commitMessage,
                actions: [
                    {
                        action: 'create',
                        file_path: filePath,
                        content,
                    },
                ],
            };
            await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/repository/commits`, payload, {
                headers: this.getHeaders(),
                timeout: 10000,
            });
            return true;
        }
        catch (err) {
            if (err.response?.status === 400 && JSON.stringify(err.response?.data).includes('already exists')) {
                try {
                    const payloadUpdate = {
                        branch: 'main',
                        commit_message: 'Update GitLab CI/CD configuration',
                        actions: [
                            {
                                action: 'update',
                                file_path: '.gitlab-ci.yml',
                                content,
                            },
                        ],
                    };
                    await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/repository/commits`, payloadUpdate, {
                        headers: this.getHeaders(),
                    });
                    return true;
                }
                catch (updateErr) {
                    console.error('[GitLab] Update .gitlab-ci.yml failed:', updateErr.message);
                }
            }
            return false;
        }
    }
    async createWebhook(projectId, webhookUrl) {
        if (!this.hasGitLab())
            return { id: 444 };
        const payload = {
            url: webhookUrl,
            push_events: true,
            issues_events: true,
            note_events: true,
            pipeline_events: true,
            enable_ssl_verification: false,
        };
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/hooks`, payload, {
                headers: this.getHeaders(),
            });
            return res.data;
        }
        catch (err) {
            return { id: 444 };
        }
    }
    async createMilestone(projectId, title, description = '', dueDate) {
        if (!this.hasGitLab()) {
            return { id: 111, title, description, due_date: dueDate };
        }
        const payload = {
            title,
            description,
            due_date: dueDate,
        };
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/v4/projects/${projectId}/milestones`, payload, {
                headers: this.getHeaders(),
            });
            return res.data;
        }
        catch (err) {
            console.error('[GitLab] Milestone creation failed:', err.response?.data || err.message);
            return { id: 111, title, description, due_date: dueDate };
        }
    }
};
exports.GitlabService = GitlabService;
exports.GitlabService = GitlabService = __decorate([
    (0, common_1.Injectable)()
], GitlabService);
//# sourceMappingURL=gitlab.service.js.map