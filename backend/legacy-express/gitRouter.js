const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const { broadcast } = require('./realtime');
const { logAudit } = require('./auditRouter');

// GET: Fetch all active repositories
router.get("/repositories", async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM repositories ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch repositories:", error);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

// POST: Award project - Auto-provisions JIRA board references, Confluence workspace, and Git Repo
router.post("/projects/:id/award", async (req, res) => {
  const { id } = req.params;
  const { collegeId, teamName, members, leadId } = req.body;

  try {
    // 1. Fetch project details
    const projCheck = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
    
    // Check if the project is in local PostgreSQL database, or check file-based fallback
    let project;
    if (projCheck.rows.length === 0) {
      // In a real staging environment, we seed and look up. If not found in PG, create a mock one:
      const name = `Enterprise App-${id}`;
      const mockProj = await db.query(
        `INSERT INTO projects (name, description, budget, duration_weeks, status) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [name, 'Mock enterprise project', 50000.00, 12, 'OPEN_FOR_BIDDING']
      );
      project = mockProj.rows[0];
    } else {
      project = projCheck.rows[0];
    }



    // Call the unified open-source provision service
    const { provisionTenantWorkspace } = require('./automationService');
    const provisionResult = await provisionTenantWorkspace(project, collegeId || 'kle-spoke');

    // 2. Update status and provision URLs
    const updatedProj = await db.query(
      `UPDATE projects 
       SET status = 'AWARDED', confluence_space_url = $1, jira_board_url = $2, keycloak_realm = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [provisionResult.bookstackUrl, provisionResult.boardUrl, provisionResult.keycloakRealm, project.id]
    );

    const cleanProjectName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const repoName = `apnileap-${cleanProjectName}`;
    const finalRepoUrl = provisionResult.repoUrl;

    const repoRes = await db.query(
      `INSERT INTO repositories (project_id, repo_name, repo_url) 
       VALUES ($1, $2, $3)
       ON CONFLICT (repo_name) DO UPDATE SET repo_url = EXCLUDED.repo_url
       RETURNING *`,
      [project.id, repoName, finalRepoUrl]
    );

    // 4. Create Project Team structures
    if (teamName) {
      await db.query(
        `INSERT INTO project_teams (project_id, name, lead_id, members)
         VALUES ($1, $2, $3, $4)`,
        [project.id, teamName, leadId || null, members || []]
      );
    }

    // 5. Audit Logging & Notification
    await logAudit({
      actor: req.user?.name || 'Platform Automation',
      action: 'PROJECT_AWARDED',
      entity: 'project',
      entityId: project.id.toString(),
      oldValue: { status: project.status },
      newValue: { status: 'AWARDED', repoName, confluenceSpaceUrl: provisionResult.bookstackUrl }
    });

    await db.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)`,
      ['all', 'Project Awarded', `Opportunity "${project.name}" has been successfully awarded to team. GitLab repository and BookStack workspace provisioned.`]
    );

    // 6. Broadcast via real-time SSE
    broadcast('PROJECT_AWARDED', {
      projectId: project.id,
      name: project.name,
      status: 'AWARDED',
      repoUrl: finalRepoUrl,
      confluenceSpaceUrl: provisionResult.bookstackUrl
    });

    res.json({
      success: true,
      message: "Project awarded and workspaces provisioned successfully!",
      project: updatedProj.rows[0],
      repository: repoRes.rows[0]
    });

  } catch (error) {
    console.error("Failed to award project:", error);
    res.status(500).json({ error: "Failed to award project" });
  }
});

module.exports = router;
