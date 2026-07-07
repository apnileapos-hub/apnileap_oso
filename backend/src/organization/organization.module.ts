import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { ProjectsController } from './projects.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [PrismaModule, AuthModule, TasksModule],
  controllers: [OrganizationController, ProjectsController],
})
export class OrganizationModule {}
