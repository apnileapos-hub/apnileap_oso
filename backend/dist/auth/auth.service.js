"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const axios_1 = require("axios");
const jwt = require('jsonwebtoken');
let AuthService = class AuthService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async login(email, password) {
        const baseUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8081';
        const realm = process.env.KEYCLOAK_REALM || 'apnileap';
        const clientId = process.env.KEYCLOAK_CLIENT_ID || 'apnileap-backend';
        const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
        try {
            const tokenUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
            const params = new URLSearchParams();
            params.append('grant_type', 'password');
            params.append('client_id', clientId);
            if (clientSecret) {
                params.append('client_secret', clientSecret);
            }
            params.append('username', email);
            params.append('password', password);
            const response = await axios_1.default.post(tokenUrl, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 5000,
            });
            const { access_token, refresh_token, expires_in } = response.data;
            const decoded = jwt.decode(access_token);
            const keycloakRoles = decoded?.realm_access?.roles || [];
            let dbRole = 'Student';
            if (keycloakRoles.includes('Super Admin'))
                dbRole = 'Super-admin';
            else if (keycloakRoles.includes('Company Admin'))
                dbRole = 'Sponsor';
            else if (keycloakRoles.includes('College Admin'))
                dbRole = 'College-SPOC';
            else if (keycloakRoles.includes('Faculty'))
                dbRole = 'Faculty';
            else if (keycloakRoles.includes('Mentor'))
                dbRole = 'Faculty';
            let user = await this.prisma.user.findUnique({ where: { email } });
            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        email,
                        name: decoded.name || decoded.preferred_username || email,
                        role: dbRole,
                        password: 'OIDC_MANAGED_PASSWORD',
                        collegeId: email.includes('kle') ? 'kle-spoke' : (email.includes('coep') ? 'coep-spoke' : (email.includes('mmcoep') ? 'mmcoep-spoke' : 'rit-spoke')),
                    },
                });
            }
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.name,
                    role: user.role,
                    collegeId: user.collegeId,
                    persona: email.includes('kle') ? 'spoke-kle' : (email.includes('coep') && !email.includes('mm') ? 'spoke-coep' : (email.includes('mmcoep') ? 'spoke-mmcoep' : (email.includes('rit') ? 'spoke-rit' : 'moderator'))),
                },
                token: access_token,
                refresh_token,
                expires_in,
            };
        }
        catch (error) {
            console.warn('[Keycloak Login Failed] Falling back to PostgreSQL local user auth check:', error.message);
            const user = await this.prisma.user.findUnique({ where: { email } });
            if (!user || user.password !== password) {
                throw new common_1.UnauthorizedException('Authentication failed: Invalid credentials');
            }
            const mockToken = jwt.sign({
                sub: `mock-user-${user.id}`,
                email: user.email,
                name: user.name,
                realm_access: {
                    roles: [user.role === 'Super-admin' ? 'Super Admin' : (user.role === 'College-SPOC' ? 'College Admin' : user.role)],
                },
            }, 'fallback-development-public-key', { expiresIn: '1h' });
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.name,
                    role: user.role,
                    collegeId: user.collegeId,
                    persona: email.includes('kle') ? 'spoke-kle' : (email.includes('coep') && !email.includes('mm') ? 'spoke-coep' : (email.includes('mmcoep') ? 'spoke-mmcoep' : (email.includes('rit') ? 'spoke-rit' : 'moderator'))),
                },
                token: mockToken,
                refresh_token: 'mock-refresh-token',
                expires_in: 3600,
            };
        }
    }
    async register(email, password, displayName, role) {
        const baseUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8081';
        const realm = process.env.KEYCLOAK_REALM || 'apnileap';
        let dbRole = 'Student';
        if (role.toLowerCase().includes('coordinator') || role.toLowerCase().includes('spoc'))
            dbRole = 'College-SPOC';
        else if (role.toLowerCase().includes('faculty') || role.toLowerCase().includes('mentor'))
            dbRole = 'Faculty';
        else if (role.toLowerCase().includes('admin'))
            dbRole = 'Super-admin';
        let user;
        try {
            user = await this.prisma.user.create({
                data: {
                    email,
                    name: displayName,
                    role: dbRole,
                    password: password,
                    collegeId: email.includes('kle') ? 'kle-spoke' : (email.includes('coep') ? 'coep-spoke' : (email.includes('mmcoep') ? 'mmcoep-spoke' : 'rit-spoke')),
                },
            });
        }
        catch (dbErr) {
            console.warn('PostgreSQL write failed or duplicate user:', dbErr.message);
            user = await this.prisma.user.findUnique({ where: { email } });
            if (!user) {
                throw new common_1.BadRequestException('User registration database failure');
            }
        }
        try {
            const adminTokenUrl = `${baseUrl}/realms/master/protocol/openid-connect/token`;
            const adminParams = new URLSearchParams();
            adminParams.append('grant_type', 'password');
            adminParams.append('client_id', 'admin-cli');
            adminParams.append('username', process.env.KEYCLOAK_ADMIN_USER || 'admin');
            adminParams.append('password', process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin');
            const adminTokenRes = await axios_1.default.post(adminTokenUrl, adminParams, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 3000,
            });
            const adminToken = adminTokenRes.data.access_token;
            const createUserUrl = `${baseUrl}/admin/realms/${realm}/users`;
            await axios_1.default.post(createUserUrl, {
                username: email,
                email: email,
                enabled: true,
                firstName: displayName.split(' ')[0] || '',
                lastName: displayName.split(' ').slice(1).join(' ') || '',
                credentials: [
                    {
                        type: 'password',
                        value: password,
                        temporary: false,
                    },
                ],
            }, {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 3000,
            });
            console.log(`Successfully provisioned user ${email} in Keycloak.`);
        }
        catch (kcErr) {
            console.warn(`[Keycloak Provisioning Bypassed] Keycloak endpoint unavailable or duplicate username: ${kcErr.message}`);
        }
        return this.login(email, password);
    }
    async refreshToken(refreshToken) {
        const baseUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8081';
        const realm = process.env.KEYCLOAK_REALM || 'apnileap';
        const clientId = process.env.KEYCLOAK_CLIENT_ID || 'apnileap-backend';
        const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
        try {
            const tokenUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('client_id', clientId);
            if (clientSecret) {
                params.append('client_secret', clientSecret);
            }
            params.append('refresh_token', refreshToken);
            const response = await axios_1.default.post(tokenUrl, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 5000,
            });
            return response.data;
        }
        catch (error) {
            console.error('Failed to refresh Keycloak OIDC token:', error.message);
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map