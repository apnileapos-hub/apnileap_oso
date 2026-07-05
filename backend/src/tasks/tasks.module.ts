import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GitlabModule } from '../gitlab/gitlab.module';

@Module({
  imports: [PrismaModule, AuthModule, GitlabModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
