"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeycloakService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let KeycloakService = class KeycloakService {
    async checkHealth() {
        const keycloakUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8081';
        try {
            const realm = process.env.KEYCLOAK_REALM || 'apnileap';
            await axios_1.default.get(`${keycloakUrl}/realms/${realm}`, { timeout: 3000 });
            return true;
        }
        catch (error) {
            if (error.response && error.response.status < 500) {
                return true;
            }
            console.error('Keycloak health check failed:', error.message);
            return false;
        }
    }
};
exports.KeycloakService = KeycloakService;
exports.KeycloakService = KeycloakService = __decorate([
    (0, common_1.Injectable)()
], KeycloakService);
//# sourceMappingURL=keycloak.service.js.map