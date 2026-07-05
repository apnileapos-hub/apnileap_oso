import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class N8nService {
  private getBaseUrl(): string {
    return process.env.N8N_BASE_URL || 'http://localhost:5678';
  }

  async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.getBaseUrl()}/healthz`, { timeout: 3000 });
      return true;
    } catch (error) {
      if (error.response && error.response.status < 500) {
        return true;
      }
      return false;
    }
  }

  async emitEvent(eventName: string, payload: any): Promise<boolean> {
    const defaultWebhooks: { [key: string]: string } = {
      'company.registration': '/webhook/company-registration',
      'company.approval': '/webhook/company-approval',
      'reminder.email': '/webhook/reminder-email',
      'deployment.notification': '/webhook/deployment-notification',
    };

    const path = defaultWebhooks[eventName] || `/webhook/${eventName}`;
    const url = `${this.getBaseUrl()}${path}`;

    try {
      console.log(`📡 [n8n Event Emission] Emitting event: "${eventName}" to: ${url}`);
      await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 4000,
      });
      return true;
    } catch (err) {
      console.warn(`[n8n Event Failed] Target webhook ${url} was not reachable or returned an error:`, err.message);
      return false;
    }
  }
}
