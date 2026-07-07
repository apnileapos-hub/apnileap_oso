import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GoogleGenAI } from '@google/genai';
import { TasksService } from '../tasks/tasks.service';

@Controller('moderator')
@UseGuards(AuthGuard, RolesGuard)
export class ProjectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  @Get('projects')
  @Roles('Super Admin', 'Company Admin', 'Moderator', 'Campus Moderator', 'Student')
  async getProjects() {
    const projects = await this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return projects;
  }

  @Post('assign')
  @Roles('Super Admin', 'Company Admin', 'Moderator')
  async autoAssignProject(@Body() body: { projectId: number; targetBoardId: string; dueDate?: string }) {
    const project = await this.prisma.project.findUnique({
      where: { id: body.projectId }
    });

    if (!project) throw new Error('Project not found');

    // 1. Update project status to "Assigned" and link to target board
    await this.prisma.project.update({
      where: { id: body.projectId },
      data: {
        status: 'Assigned',
        spokeId: body.targetBoardId === '3' ? 'kle-spoke' : (body.targetBoardId === '101' ? 'coep-spoke' : (body.targetBoardId === '102' ? 'mmcoep-spoke' : 'rit-spoke'))
      }
    });

    // 2. Loop through AI generated phases and create tasks in the target Hub
    let createdTasks = [];
    if (project.epics && Array.isArray(project.epics)) {
      for (const phase of (project.epics as any[])) {
        const task = await this.tasksService.createTask({
          boardId: body.targetBoardId,
          summary: phase.title || 'AI Phase',
          description: phase.description || '',
          issueTypeName: 'Task',
          statusName: 'Backlog',
          dueDate: body.dueDate
        }, 'Central Moderator');
        createdTasks.push(task);
      }
    }

    return { 
      success: true, 
      assignedTo: body.targetBoardId === '3' ? 'KLE Hub' : 'Partner Hub',
      tasksCreated: createdTasks.length
    };
  }


  @Post('projects')
  @Roles('Super Admin', 'Company Admin', 'Moderator')
  async createProject(@Body() body: any) {
    // 1. Receive SRS and other project details
    const { company, title, description: srsDocument, budget, duration, proposedDueDate } = body;

    // 2. Real AI Processing: Analyze SRS and generate phases via Vertex AI
    const generatedPhases = await this.realAiGeneratePhases(title, srsDocument);

    // 3. Save project with the AI-generated phases in the `epics` JSON field
    const project = await this.prisma.project.create({
      data: {
        title: title,
        description: srsDocument,
        status: 'Proposal',
        budget: budget ? parseFloat(budget.replace(/[^0-9.-]+/g, '')) : 0,
        durationWeeks: duration ? parseInt(duration) : 0,
        epics: generatedPhases, 
        // company mapping would go here if we look up by company name
      },
    });

    return { success: true, project };
  }

  /**
   * REAL AI GENERATOR:
   * Uses Gemini via Vertex AI to parse the SRS and output a structured JSON array of phases.
   */
  private async realAiGeneratePhases(title: string, srs: string) {
    try {
      const ai = new GoogleGenAI({
        vertexai: true,
        project: 'apnileap',
        location: 'us-central1',
      });

      const prompt = `
You are an expert technical project manager and architect. 
I am providing you with the Software Requirements Specification (SRS) for a project titled "${title}".
Please analyze this document and design the core project phases and milestones.
Output the result strictly as a JSON array of objects. Do not include markdown code blocks, just the raw JSON.
Each object in the array should represent a phase and have the following schema:
- "id": a number representing the phase order (1, 2, 3...)
- "title": a string (e.g., "Phase 1: Architecture")
- "description": a short description of the phase goal.
- "status": exactly the string "To Do"
- "tasks": an array of objects, where each object has a "title" (string) and "status" (exactly "To Do").

Here is the SRS Document:
${srs}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        }
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
      return [];
    } catch (error) {
      console.error('Error calling Gemini AI:', error);
      // Fallback to mock if API fails
      return this.mockAiGeneratePhases(title, srs);
    }
  }

  /**
   * MOCK AI GENERATOR (Fallback):
   */
  private mockAiGeneratePhases(title: string, srs: string) {
    return [
      {
        id: 1,
        title: 'Phase 1: Requirements & Architecture',
        description: `Analyze the provided SRS document and establish the core architecture for ${title}.`,
        status: 'To Do',
        tasks: [
          { title: 'Finalize SRS review with stakeholders', status: 'To Do' },
          { title: 'Draft System Architecture Document', status: 'To Do' }
        ]
      },
      {
        id: 2,
        title: 'Phase 2: Core Implementation',
        description: 'Build the primary features and endpoints outlined in the SRS.',
        status: 'To Do',
        tasks: [
          { title: 'Setup database schemas', status: 'To Do' },
          { title: 'Develop core API endpoints', status: 'To Do' },
          { title: 'Implement UI components', status: 'To Do' }
        ]
      },
      {
        id: 3,
        title: 'Phase 3: QA & Delivery',
        description: 'Testing, QA, and handover of the completed project.',
        status: 'To Do',
        tasks: [
          { title: 'Perform integration testing', status: 'To Do' },
          { title: 'User Acceptance Testing (UAT)', status: 'To Do' },
          { title: 'Final Deployment', status: 'To Do' }
        ]
      }
    ];
  }
}
