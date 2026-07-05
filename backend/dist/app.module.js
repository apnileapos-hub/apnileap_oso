"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("./prisma/prisma.module");
const redis_module_1 = require("./redis/redis.module");
const rabbitmq_module_1 = require("./rabbitmq/rabbitmq.module");
const minio_module_1 = require("./minio/minio.module");
const health_module_1 = require("./health/health.module");
const auth_module_1 = require("./auth/auth.module");
const organization_module_1 = require("./organization/organization.module");
const teams_module_1 = require("./teams/teams.module");
const users_module_1 = require("./users/users.module");
const onboarding_module_1 = require("./onboarding/onboarding.module");
const tasks_module_1 = require("./tasks/tasks.module");
const storage_module_1 = require("./storage/storage.module");
const submissions_module_1 = require("./submissions/submissions.module");
const audit_module_1 = require("./audit/audit.module");
const meetings_module_1 = require("./meetings/meetings.module");
const analytics_module_1 = require("./analytics/analytics.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            rabbitmq_module_1.RabbitmqModule,
            minio_module_1.MinioModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            organization_module_1.OrganizationModule,
            teams_module_1.TeamsModule,
            users_module_1.UsersModule,
            onboarding_module_1.OnboardingModule,
            tasks_module_1.TasksModule,
            storage_module_1.StorageModule,
            submissions_module_1.SubmissionsModule,
            audit_module_1.AuditModule,
            meetings_module_1.MeetingsModule,
            analytics_module_1.AnalyticsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map