"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookstackService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let BookstackService = class BookstackService {
    getBaseUrl() {
        return process.env.BOOKSTACK_BASE_URL || 'http://localhost:8082';
    }
    getTokenId() {
        return process.env.BOOKSTACK_TOKEN_ID || '';
    }
    getTokenSecret() {
        return process.env.BOOKSTACK_TOKEN_SECRET || '';
    }
    getHeaders() {
        return {
            Authorization: `Token ${this.getTokenId()}:${this.getTokenSecret()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };
    }
    hasBookStack() {
        return !!(this.getTokenId() && this.getTokenSecret());
    }
    async checkHealth() {
        try {
            await axios_1.default.get(`${this.getBaseUrl()}/api/books`, {
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
    async createShelf(name, description = '') {
        if (!this.hasBookStack()) {
            return { id: 100 + Math.floor(Math.random() * 100), name, slug: 'mock-shelf' };
        }
        const payload = {
            name,
            description: description || `Shelf for company ${name}`,
        };
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/shelves`, payload, {
                headers: this.getHeaders(),
                timeout: 8000,
            });
            return res.data;
        }
        catch (err) {
            console.warn('[BookStack] Create Shelf failed:', err.message);
            return { id: 100, name, slug: 'mock-shelf' };
        }
    }
    async createBook(name, description = '') {
        if (!this.hasBookStack()) {
            return { id: 200 + Math.floor(Math.random() * 100), name, slug: 'mock-book' };
        }
        const payload = {
            name,
            description: description || `Book for workspace ${name}`,
        };
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/books`, payload, {
                headers: this.getHeaders(),
                timeout: 8000,
            });
            return res.data;
        }
        catch (err) {
            console.warn('[BookStack] Create Book failed:', err.message);
            return { id: 200, name, slug: 'mock-book' };
        }
    }
    async associateBookToShelf(shelfId, bookId) {
        if (!this.hasBookStack())
            return true;
        try {
            const getRes = await axios_1.default.get(`${this.getBaseUrl()}/api/shelves/${shelfId}`, {
                headers: this.getHeaders(),
            });
            const currentBooks = (getRes.data.books || []).map((b) => b.id);
            if (!currentBooks.includes(bookId)) {
                currentBooks.push(bookId);
            }
            await axios_1.default.put(`${this.getBaseUrl()}/api/shelves/${shelfId}`, { books: currentBooks }, { headers: this.getHeaders() });
            return true;
        }
        catch (err) {
            console.warn('[BookStack] Associate book to shelf failed:', err.message);
            return false;
        }
    }
    async createPage(bookId, name, htmlContent) {
        if (!this.hasBookStack()) {
            return { id: 300 + Math.floor(Math.random() * 1000), name, slug: 'mock-page' };
        }
        const payload = {
            book_id: bookId,
            name,
            html: htmlContent,
        };
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/pages`, payload, {
                headers: this.getHeaders(),
                timeout: 8000,
            });
            return res.data;
        }
        catch (err) {
            console.warn(`[BookStack] Create page "${name}" failed:`, err.message);
            return { id: 300, name, slug: 'mock-page' };
        }
    }
    async provisionCompanyDocumentation(companyName) {
        console.log(`[BookStack Provisioning] Launching setup for company: ${companyName}`);
        const shelf = await this.createShelf(companyName, `Documentation hub shelf for ${companyName}`);
        const book = await this.createBook('apnileap-workspace', `Workspace collaboration documentation book for ${companyName}`);
        if (shelf?.id && book?.id) {
            await this.associateBookToShelf(shelf.id, book.id);
        }
        const pageTemplates = [
            { name: 'Requirements', html: '<h1>Project Requirements & Specifications</h1><p>Define product scoping, user stories, and target milestones here.</p>' },
            { name: 'Architecture', html: '<h1>Architecture Design</h1><p>Outline components structures, UI workflows, and service configurations.</p>' },
            { name: 'API Docs', html: '<h1>REST API Documentation</h1><p>Document backend controllers routes, payload specs, and OpenAPI schemas.</p>' },
            { name: 'Database', html: '<h1>Database Schema Models</h1><p>Document entity relationship constraints and Postgres RLS mapping details.</p>' },
            { name: 'Meeting Notes', html: '<h1>Meeting Notes & Sync Logs</h1><p>Log discussion summaries and sprint action items here.</p>' },
            { name: 'Sprint Notes', html: '<h1>Sprint Planning Notes</h1><p>Review sprints backlogs progress reports.</p>' },
            { name: 'Deployment', html: '<h1>Deployment & Orchestration Guides</h1><p>Describe Docker and Kubernetes build manifests configuration.</p>' },
            { name: 'Reports', html: '<h1>Project Progress Reports</h1><p>Attach final QA code audits and sprint evaluation summaries.</p>' },
        ];
        if (book?.id) {
            for (const t of pageTemplates) {
                await this.createPage(book.id, t.name, t.html);
            }
        }
        const shelfSlug = shelf.slug || companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const bookSlug = book.slug || 'apnileap-workspace';
        return {
            shelfUrl: `${this.getBaseUrl()}/shelves/${shelfSlug}`,
            bookUrl: `${this.getBaseUrl()}/books/${bookSlug}`,
        };
    }
};
exports.BookstackService = BookstackService;
exports.BookstackService = BookstackService = __decorate([
    (0, common_1.Injectable)()
], BookstackService);
//# sourceMappingURL=bookstack.service.js.map