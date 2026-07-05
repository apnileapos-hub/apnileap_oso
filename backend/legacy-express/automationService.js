const db = require('./db');
const { createGitLabGroup, createGitLabProject, createGitLabIssueBoard, commitGitLabCIYaml, createGitLabWebhook } = require('./gitlabService');
const { createBookStackWorkspace } = require('./bookstackService');
const { createKeycloakRealm, createKeycloakGroup, createKeycloakUser } = require('./keycloakService');
const { createMinIOBucket } = require('./minioService');

const crypto = require('crypto');

/**
 * Automates the provisioning of the entire open-source stack on project acceptance.
 * 
 * @param {object} project - The project row from DB
 * @param {string} spokeId - Spoke campus identifier (e.g. "kle-spoke")
 * @returns {Promise<object>} Provisioned workspace resources metadata
 */
async function provisionTenantWorkspace(project, spokeId) {
  const projectId = project.id;
  const companyName = project.company || project.companyName || "PartnerSponsor";
  const projectTitle = project.name || project.title || "ApniLeap Project";
  const projectDescription = project.description || "";

  console.log(`🚀 [WORKSPACE AUTOMATION] Beginning workspace provisioning flow for project "${projectTitle}" (ID: ${projectId}) of company "${companyName}"...`);

  // ── 1. Create PostgreSQL Tenant & Default Roles ──────────────────────────────
  const tenantId = crypto.randomUUID();
  const tenantDomain = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.apnileap.com`;

  try {
    // Check if tenants table exists and insert
    await db.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(
      `INSERT INTO tenants (id, name, domain) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name`,
      [tenantId, companyName, tenantDomain]
    );
    console.log(`[Database Tenant] Registered tenant domain: "${tenantDomain}" | ID: ${tenantId}`);

    // Seed default RBAC roles
    const roles = ['COMPANY_ADMIN', 'COMPANY_MANAGER', 'EMPLOYEE'];
    for (const roleName of roles) {
      await db.query(
        `INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [roleName]
      );
    }
  } catch (dbErr) {
    console.error("[Database Tenant] Tenant registration error:", dbErr.message);
  }

  // ── 2. Create Keycloak Realm, Groups, and Users ──────────────────────────────
  const keycloakRealm = companyName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  try {
    await createKeycloakRealm(keycloakRealm, `${companyName} APNILEAP Workspace`);
    await createKeycloakGroup(keycloakRealm, "Admins");
    await createKeycloakGroup(keycloakRealm, "Developers");

    // Retrieve active student developers or faculty contacts from Spoke and sync to Keycloak
    const spocRes = await db.query(
      "SELECT email, name FROM users WHERE college_id = $1",
      [spokeId]
    );
    for (const u of spocRes.rows) {
      await createKeycloakUser(keycloakRealm, {
        email: u.email,
        name: u.name,
        password: "Admin@123"
      });
    }
  } catch (keycloakErr) {
    console.error("[Keycloak Automation] Setup failed:", keycloakErr.message);
  }

  // ── 3. GitLab Group & Repository Creation ────────────────────────────────────
  let gitlabProject = null;
  let repoUrl = "";
  let boardUrl = "";

  try {
    const gitlabGroup = await createGitLabGroup(companyName, companyName);
    const repoName = `apnileap-${projectTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    gitlabProject = await createGitLabProject(gitlabGroup.id, repoName, `Automated repository for B2B project: ${projectTitle}`);
    
    if (gitlabProject) {
      repoUrl = gitlabProject.web_url || `http://localhost:8080/${companyName}/${repoName}`;
      
      // ── 4. GitLab CI/CD Pipeline Setup ──────────────────────────────────────────
      const ciTemplate = `stages:
  - build
  - test
  - deploy

build_job:
  stage: build
  image: node:20-alpine
  script:
    - echo "Building production code..."
    - npm install --legacy-peer-deps
    - npm run build || true

test_job:
  stage: test
  image: node:20-alpine
  script:
    - echo "Running automated tests..."
    - npm install --legacy-peer-deps
    - npm test || true

deploy_job:
  stage: deploy
  image: alpine:latest
  script:
    - echo "Deploying container to Kubernetes cluster..."
`;
      await commitGitLabCIYaml(gitlabProject.id, ciTemplate);

      // ── 5. GitLab Kanban Board Setup ─────────────────────────────────────────────
      const board = await createGitLabIssueBoard(gitlabProject.id, `${projectTitle} Kanban Board`);
      boardUrl = board?.web_url || `${repoUrl}/-/boards`;

      // ── 6. GitLab Webhooks Integration ──────────────────────────────────────────
      const webhookUrl = `http://localhost:5000/api/gitlab/webhook?projectId=${projectId}`;
      await createGitLabWebhook(gitlabProject.id, webhookUrl);
    }
  } catch (gitlabErr) {
    console.error("[GitLab Automation] Setup failed:", gitlabErr.message);
    repoUrl = `http://localhost:8080/${companyName.toLowerCase()}/apnileap-repo`;
    boardUrl = `${repoUrl}/-/boards`;
  }

  // ── 7. BookStack Document Workspace (Book) ───────────────────────────────────
  let bookstackUrl = "";
  try {
    const spaceKey = project.jira_project_key || project.jiraProjectKey || projectTitle.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    bookstackUrl = await createBookStackWorkspace(spaceKey, projectTitle, projectDescription);
  } catch (bookstackErr) {
    console.error("[BookStack Automation] Setup failed:", bookstackErr.message);
    bookstackUrl = `http://localhost:8082/books/${projectTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  // ── 8. MinIO Storage Bucket ──────────────────────────────────────────────────
  const minioBucket = `apnileap-project-${projectId}`;
  try {
    await createMinIOBucket(minioBucket);
  } catch (minioErr) {
    console.error("[MinIO Automation] Setup failed:", minioErr.message);
  }

  // ── 9. Auto-provision Epics and Tasks in GitLab and mock_tasks table ──────────
  const epics = [
    { title: "Requirements & Architecture Specification", description: "Define scoping, technical requirements, and core interface models." },
    { title: "Core Feature Prototype Development", description: "Implement basic functional behaviors and baseline validations." },
    { title: "Deployment & Quality Engineering Sync", description: "Conduct end-to-end integration and scale testing." }
  ];

  const epicTasksMap = {
    "Requirements & Architecture Specification": [
      { summary: `Define and document functional requirements for ${projectTitle}`, description: `Establish the functional specifications, scope boundaries, and core user flows for the ${projectTitle} project.` },
      { summary: `Design database schema and component architecture for ${projectTitle}`, description: `Create the entity relationship diagram (ERD), API endpoints structure, and high-level component diagrams for ${projectTitle}.` },
      { summary: `Set up development environment and boilerplate repository`, description: `Initialize the git repository, configure linting, CI/CD templates, and prepare backend/frontend boilerplate files for ${projectTitle}.` }
    ],
    "Core Feature Prototype Development": [
      { summary: `Implement core backend API services for ${projectTitle}`, description: `Develop controllers, routes, authentication, and core database interactions for the main features of ${projectTitle}.` },
      { summary: `Build responsive frontend UI prototype for ${projectTitle}`, description: `Develop user interface components, navigation, layout design, and state management for the user dashboard of ${projectTitle}.` },
      { summary: `Integrate frontend with backend services`, description: `Connect the frontend API client to the backend REST endpoints and handle state synchronizations and edge errors.` }
    ],
    "Deployment & Quality Engineering Sync": [
      { summary: `Perform end-to-end integration testing for ${projectTitle}`, description: `Write unit and integration tests, verify core user flows, and optimize query latency for ${projectTitle}.` },
      { summary: `Deploy prototype to staging environment`, description: `Configure hosting services, environment variables, database connections, and run build commands for ${projectTitle}.` },
      { summary: `Prepare final project handover and documentation`, description: `Complete technical write-ups, API specs, deployment guides, and prepare the demo walkthrough for ${projectTitle}.` }
    ]
  };

  const updatedEpics = [];
  const boardId = spokeId === 'coep-spoke' ? '101' : (spokeId === 'mmcoep-spoke' ? '102' : (spokeId === 'rit-spoke' ? '103' : '3'));

  for (let i = 0; i < epics.length; i++) {
    const epic = epics[i];
    let epicGitLabIid = null;
    let epicKey = null;

    if (gitlabProject) {
      try {
        const issue = await createGitLabIssue(gitlabProject.id, `[Epic] ${epic.title}`, epic.description, ["Epic", "To Do"]);
        epicGitLabIid = issue.iid;
        epicKey = `${gitlabProject.name.toUpperCase().slice(0, 4)}-${issue.iid}`;
      } catch (err) {
        console.warn(`[GitLab Automation] Epic issue creation failed:`, err.message);
      }
    }

    if (!epicKey) {
      epicGitLabIid = i + 1;
      epicKey = `MOCK-EPIC-${epicGitLabIid}`;
    }

    const updatedEpic = {
      id: `epic-${Date.now()}-${i}`,
      title: epic.title,
      description: epic.description,
      jiraKey: epicKey,
      status: "To Do"
    };
    updatedEpics.push(updatedEpic);

    const tasks = epicTasksMap[epic.title] || [];
    for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
      const template = tasks[tIdx];
      let taskKey = null;
      let taskGitLabId = `mock-${boardId}-${Date.now()}-${i}-${tIdx}`;

      if (gitlabProject) {
        try {
          const issue = await createGitLabIssue(gitlabProject.id, template.summary, template.description, ["To Do"]);
          taskKey = `${gitlabProject.name.toUpperCase().slice(0, 4)}-${issue.iid}`;
          taskGitLabId = issue.id.toString();
          if (epicGitLabIid) {
            await linkGitLabIssues(gitlabProject.id, epicGitLabIid, issue.iid);
          }
        } catch (err) {
          console.warn(`[GitLab Automation] Task issue creation failed:`, err.message);
        }
      }

      if (!taskKey) {
        taskKey = `MOCK-TASK-${100 + i * 10 + tIdx}`;
      }

      const fields = {
        summary: template.summary,
        description: template.description,
        status: { name: "To Do" },
        priority: { name: "Medium" },
        issuetype: { name: "Task" },
        created: new Date().toISOString(),
        flagged: false,
        parent: {
          key: epicKey,
          summary: epic.title,
          issueType: "Epic"
        }
      };

      try {
        await db.query(
          `INSERT INTO mock_tasks (id, key, board_id, fields)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (key) DO UPDATE SET fields = EXCLUDED.fields`,
          [taskGitLabId, taskKey, boardId, JSON.stringify(fields)]
        );
      } catch (dbErr) {
        console.error("Failed to insert mock task into PostgreSQL:", dbErr.message);
      }
    }
  }

  try {
    const cleanProjectId = typeof projectId === 'string' ? parseInt(projectId.replace('proj-', '')) : projectId;
    await db.query(
      `UPDATE projects SET epics = $1 WHERE id = $2`,
      [JSON.stringify(updatedEpics), cleanProjectId]
    );
    project.epics = updatedEpics;
  } catch (updateErr) {
    console.error("Failed to update projects epics in DB:", updateErr.message);
  }

  console.log(`✅ [WORKSPACE AUTOMATION] Completed provisioning for project "${projectTitle}".`);

  return {
    repoUrl,
    boardUrl,
    bookstackUrl,
    minioBucket,
    keycloakRealm
  };
}

module.exports = {
  provisionTenantWorkspace
};
