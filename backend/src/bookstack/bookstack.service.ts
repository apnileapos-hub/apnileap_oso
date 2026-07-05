import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class BookstackService {
  private getBaseUrl(): string {
    return process.env.BOOKSTACK_BASE_URL || 'http://localhost:8082';
  }

  private getTokenId(): string {
    return process.env.BOOKSTACK_TOKEN_ID || '';
  }

  private getTokenSecret(): string {
    return process.env.BOOKSTACK_TOKEN_SECRET || '';
  }

  private getHeaders() {
    return {
      Authorization: `Token ${this.getTokenId()}:${this.getTokenSecret()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private hasBookStack(): boolean {
    return !!(this.getTokenId() && this.getTokenSecret());
  }

  async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.getBaseUrl()}/api/books`, {
        headers: this.getHeaders(),
        timeout: 3000,
      });
      return true;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        return true;
      }
      return false;
    }
  }

  async createShelf(name: string, description: string = ''): Promise<any> {
    if (!this.hasBookStack()) {
      return { id: 100 + Math.floor(Math.random() * 100), name, slug: 'mock-shelf' };
    }

    const payload = {
      name,
      description: description || `Shelf for company ${name}`,
    };

    try {
      const res = await axios.post(`${this.getBaseUrl()}/api/shelves`, payload, {
        headers: this.getHeaders(),
        timeout: 8000,
      });
      return res.data;
    } catch (err) {
      console.warn('[BookStack] Create Shelf failed:', err.message);
      return { id: 100, name, slug: 'mock-shelf' };
    }
  }

  async createBook(name: string, description: string = ''): Promise<any> {
    if (!this.hasBookStack()) {
      return { id: 200 + Math.floor(Math.random() * 100), name, slug: 'mock-book' };
    }

    const payload = {
      name,
      description: description || `Book for workspace ${name}`,
    };

    try {
      const res = await axios.post(`${this.getBaseUrl()}/api/books`, payload, {
        headers: this.getHeaders(),
        timeout: 8000,
      });
      return res.data;
    } catch (err) {
      console.warn('[BookStack] Create Book failed:', err.message);
      return { id: 200, name, slug: 'mock-book' };
    }
  }

  async associateBookToShelf(shelfId: number, bookId: number): Promise<boolean> {
    if (!this.hasBookStack()) return true;

    try {
      // Fetch shelf first to get its current books
      const getRes = await axios.get(`${this.getBaseUrl()}/api/shelves/${shelfId}`, {
        headers: this.getHeaders(),
      });
      const currentBooks = (getRes.data.books || []).map((b: any) => b.id);
      
      if (!currentBooks.includes(bookId)) {
        currentBooks.push(bookId);
      }

      await axios.put(
        `${this.getBaseUrl()}/api/shelves/${shelfId}`,
        { books: currentBooks },
        { headers: this.getHeaders() },
      );
      return true;
    } catch (err) {
      console.warn('[BookStack] Associate book to shelf failed:', err.message);
      return false;
    }
  }

  async createPage(bookId: number, name: string, htmlContent: string): Promise<any> {
    if (!this.hasBookStack()) {
      return { id: 300 + Math.floor(Math.random() * 1000), name, slug: 'mock-page' };
    }

    const payload = {
      book_id: bookId,
      name,
      html: htmlContent,
    };

    try {
      const res = await axios.post(`${this.getBaseUrl()}/api/pages`, payload, {
        headers: this.getHeaders(),
        timeout: 8000,
      });
      return res.data;
    } catch (err) {
      console.warn(`[BookStack] Create page "${name}" failed:`, err.message);
      return { id: 300, name, slug: 'mock-page' };
    }
  }

  async provisionCompanyDocumentation(companyName: string): Promise<{ bookUrl: string; shelfUrl: string }> {
    console.log(`[BookStack Provisioning] Launching setup for company: ${companyName}`);
    
    // 1. Create Shelf
    const shelf = await this.createShelf(companyName, `Documentation hub shelf for ${companyName}`);
    
    // 2. Create Book
    const book = await this.createBook('apnileap-workspace', `Workspace collaboration documentation book for ${companyName}`);
    
    // 3. Link Shelf & Book
    if (shelf?.id && book?.id) {
      await this.associateBookToShelf(shelf.id, book.id);
    }

    // 4. Create standard pages
    const pageTemplates = [
      { name: 'Requirements', html: '<h1>Project Requirements & Specifications</h1><p>Define product scoping, user stories, and target milestones here.</p>' },
      { name: 'Architecture', html: '<h1>Architecture Design</h1><p>Outline components structures, UI workflows, and service configurations.</p>' },
      { name: 'API Docs', html: '<h1>REST API Documentation</h1><p>Document backend controllers routes, payload specs, and OpenAPI schemas.</p>' },
      { name: 'Database', html: '<h1>Database Schema Models</h1><p>Document entity relationship constraints and Postgres RLS mapping details.</p>' },
      { name: 'Meeting Notes', html: '<h1>Meeting Notes & Sync Logs</h1><p>Log discussion summaries and sprint action items here.</p>' },
      { name: 'Sprint Notes', html: '<h1>Sprint Planning Notes</h1><p>Review sprints backlogs progress reports.</p>' },
      { name: 'Deployment', html: '<h1>Deployment & Orchestration Guides</h1><p>Describe Docker and Kubernetes build manifests configuration.</p>' },
      { name: 'Reports', html: '<h1>Project Progress Reports</h1><p>Attach final QA code audits and sprint evaluation summaries.</p>' },
    ];

    if (book?.id) {
      for (const t of pageTemplates) {
        await this.createPage(book.id, t.name, t.html);
      }
    }

    const shelfSlug = shelf.slug || companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const bookSlug = book.slug || 'apnileap-workspace';

    return {
      shelfUrl: `${this.getBaseUrl()}/shelves/${shelfSlug}`,
      bookUrl: `${this.getBaseUrl()}/books/${bookSlug}`,
    };
  }
}
