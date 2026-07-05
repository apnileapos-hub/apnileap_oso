import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GitlabModule } from '../gitlab/gitlab.module';
import { WikiModule } from '../wiki/wiki.module';
import { N8nModule } from '../n8n/n8n.module';

@Module({
  imports: [PrismaModule, AuthModule, GitlabModule, WikiModule, N8nModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
