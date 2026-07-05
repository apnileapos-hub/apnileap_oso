import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GitlabModule } from '../gitlab/gitlab.module';
import { BookstackModule } from '../bookstack/bookstack.module';
import { KeycloakModule } from '../keycloak/keycloak.module';
import { N8nModule } from '../n8n/n8n.module';

@Module({
  imports: [GitlabModule, BookstackModule, KeycloakModule, N8nModule],
  controllers: [HealthController],
})
export class HealthModule {}

