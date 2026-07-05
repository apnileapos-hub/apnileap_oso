"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let WikiService = class WikiService {
    getBaseUrl() {
        return process.env.WIKIJ_BASE_URL || 'http://localhost:3000';
    }
    getToken() {
        return process.env.WIKIJ_API_TOKEN || '';
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${this.getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };
    }
    async checkHealth() {
        try {
            await axios_1.default.get(`${this.getBaseUrl()}/api`, { headers: this.getHeaders(), timeout: 3000 });
            return true;
        }
        catch (err) {
            return false;
        }
    }
    async provisionCompanyDocumentation(companyName) {
        const spacePayload = { name: companyName, description: `${companyName} documentation space` };
        let spaceId = null;
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/spaces`, spacePayload, { headers: this.getHeaders() });
            spaceId = res.data.id;
        }
        catch (err) {
            spaceId = Math.floor(Math.random() * 1000) + 100;
        }
        const pagePayload = { title: 'Welcome', content: `# Welcome to ${companyName}\nThis space is auto‑provisioned.` };
        let pageId = null;
        try {
            const res = await axios_1.default.post(`${this.getBaseUrl()}/api/pages`, { ...pagePayload, spaceId }, { headers: this.getHeaders() });
            pageId = res.data.id;
        }
        catch (err) {
            pageId = Math.floor(Math.random() * 1000) + 200;
        }
        const spaceUrl = `${this.getBaseUrl()}/spaces/${spaceId}`;
        const pageUrl = `${this.getBaseUrl()}/pages/${pageId}`;
        return { spaceUrl, pageUrl };
    }
};
exports.WikiService = WikiService;
exports.WikiService = WikiService = __decorate([
    (0, common_1.Injectable)()
], WikiService);
//# sourceMappingURL=wiki.service.js.map