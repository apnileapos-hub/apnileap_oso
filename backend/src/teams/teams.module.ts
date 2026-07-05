import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TeamsController],
})
export class TeamsModule {}
