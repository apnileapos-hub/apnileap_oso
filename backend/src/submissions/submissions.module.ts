import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GitlabModule } from '../gitlab/gitlab.module';

@Module({
  imports: [PrismaModule, AuthModule, GitlabModule],
  controllers: [SubmissionsController],
})
export class SubmissionsModule {}
