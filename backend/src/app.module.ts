import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { MinioModule } from './minio/minio.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { TasksModule } from './tasks/tasks.module';
import { StorageModule } from './storage/storage.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AuditModule } from './audit/audit.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    RabbitmqModule,
    MinioModule,
    HealthModule,
    AuthModule,
    OrganizationModule,
    TeamsModule,
    UsersModule,
    OnboardingModule,
    TasksModule,
    StorageModule,
    SubmissionsModule,
    AuditModule,
    MeetingsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}

