"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let N8nService = class N8nService {
    getBaseUrl() {
        return process.env.N8N_BASE_URL || 'http://localhost:5678';
    }
    async checkHealth() {
        try {
            await axios_1.default.get(`${this.getBaseUrl()}/healthz`, { timeout: 3000 });
            return true;
        }
        catch (error) {
            if (error.response && error.response.status < 500) {
                return true;
            }
            return false;
        }
    }
    async emitEvent(eventName, payload) {
        const defaultWebhooks = {
            'company.registration': '/webhook/company-registration',
            'company.approval': '/webhook/company-approval',
            'reminder.email': '/webhook/reminder-email',
            'deployment.notification': '/webhook/deployment-notification',
        };
        const path = defaultWebhooks[eventName] || `/webhook/${eventName}`;
        const url = `${this.getBaseUrl()}${path}`;
        try {
            console.log(`📡 [n8n Event Emission] Emitting event: "${eventName}" to: ${url}`);
            await axios_1.default.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 4000,
            });
            return true;
        }
        catch (err) {
            console.warn(`[n8n Event Failed] Target webhook ${url} was not reachable or returned an error:`, err.message);
            return false;
        }
    }
};
exports.N8nService = N8nService;
exports.N8nService = N8nService = __decorate([
    (0, common_1.Injectable)()
], N8nService);
//# sourceMappingURL=n8n.service.js.map