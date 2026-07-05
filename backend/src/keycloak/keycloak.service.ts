import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class KeycloakService {
  async checkHealth(): Promise<boolean> {
    const keycloakUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8081';
    try {
      const realm = process.env.KEYCLOAK_REALM || 'apnileap';
      await axios.get(`${keycloakUrl}/realms/${realm}`, { timeout: 3000 });
      return true;
    } catch (error) {
      if (error.response && error.response.status < 500) {
        return true; // Keycloak server responded (e.g. 404 Realm Not Found counts as reachable)
      }
      console.error('Keycloak health check failed:', error.message);
      return false;
    }
  }
}
