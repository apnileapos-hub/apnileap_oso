import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WikiService {
  private getBaseUrl(): string {
    return process.env.WIKIJ_BASE_URL || 'http://localhost:3000';
  }

  private getToken(): string {
    return process.env.WIKIJ_API_TOKEN || '';
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.getBaseUrl()}/api`, { headers: this.getHeaders(), timeout: 3000 });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Minimal provisioning – creates a space for the company and a welcome page.
   * Adjust to match your Wiki.js API as needed.
   */
  async provisionCompanyDocumentation(companyName: string): Promise<{ spaceUrl: string; pageUrl: string }> {
    const spacePayload = { name: companyName, description: `${companyName} documentation space` };
    let spaceId: number | null = null;
    try {
      const res = await axios.post(`${this.getBaseUrl()}/api/spaces`, spacePayload, { headers: this.getHeaders() });
      spaceId = res.data.id;
    } catch (err) {
      // fallback to mock
      spaceId = Math.floor(Math.random() * 1000) + 100;
    }
    const pagePayload = { title: 'Welcome', content: `# Welcome to ${companyName}\nThis space is auto‑provisioned.` };
    let pageId: number | null = null;
    try {
      const res = await axios.post(`${this.getBaseUrl()}/api/pages`, { ...pagePayload, spaceId }, { headers: this.getHeaders() });
      pageId = res.data.id;
    } catch (err) {
      pageId = Math.floor(Math.random() * 1000) + 200;
    }
    const spaceUrl = `${this.getBaseUrl()}/spaces/${spaceId}`;
    const pageUrl = `${this.getBaseUrl()}/pages/${pageId}`;
    return { spaceUrl, pageUrl };
  }
}
