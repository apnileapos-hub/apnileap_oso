const db = require('./db');
const axios = require('axios');
require('dotenv').config();

const getJiraBase = () => process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";
const getJiraAuth = () => ({
  username: process.env.JIRA_EMAIL,
  password: process.env.JIRA_API_TOKEN,
});

const jiraHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Auto-creates a new Jira project in Atlassian if none exists
 */
async function autoCreateJiraProject(projectTitle) {
  try {
    const jiraBase = getJiraBase();
    const jiraAuth = getJiraAuth();

    if (!jiraAuth.username || !jiraAuth.password) {
      console.warn("Jira credentials not configured. Using fallback project key.");
      return "APNI" + Math.floor(100 + Math.random() * 900);
    }

    // Fetch current user account ID to set as lead
    const userRes = await axios.get(`${jiraBase}/rest/api/3/myself`, {
      auth: jiraAuth,
      headers: { Accept: "application/json" },
      timeout: 5000
    });
    const leadAccountId = userRes.data.accountId;

    // Generate a clean uppercase unique key from the project title
    let cleanKey = projectTitle
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .map(w => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 10);
    
    if (cleanKey.length < 3) {
      cleanKey = (cleanKey + "PROJ").slice(0, 4).toUpperCase();
    }

    cleanKey = `${cleanKey}${Math.floor(10 + Math.random() * 90)}`;

    console.log(`Auto-creating Jira project via Rovo: ${cleanKey} (${projectTitle})`);

    await axios.post(
      `${jiraBase}/rest/api/3/project`,
      {
        key: cleanKey,
        name: `${projectTitle.slice(0, 50)} (${cleanKey})`,
        projectTypeKey: "software",
        projectTemplateKey: "com.pyxis.greenhopper.jira:gh-simplified-kanban-classic",
        leadAccountId: leadAccountId,
        description: `Auto-provisioned via APNILEAP for project ${projectTitle}`
      },
      { auth: jiraAuth, headers: jiraHeaders }
    );

    console.log(`Successfully auto-provisioned Jira project: ${cleanKey}`);
    return cleanKey;
  } catch (err) {
    console.error("Failed to auto-create Jira project:", err.response?.data || err.message);
    return "APNI" + Math.floor(100 + Math.random() * 900);
  }
}

/**
 * Automatically creates Epics and highly specific Tasks under them in Jira and local PostgreSQL
 */
async function autoGenerateIssuesForProject(project, jiraProjectKey) {
  const jiraBase = getJiraBase();
  const jiraAuth = getJiraAuth();
  const hasJira = !!(jiraAuth.username && jiraAuth.password);

  console.log(`🤖 Rovo Agent starting issue auto-generation for project "${project.name || project.title}" (Jira Key: ${jiraProjectKey})`);

  // 1. Get or create the Epics list
  let epics = [];
  const rawEpics = project.epics;
  if (Array.isArray(rawEpics)) {
    epics = rawEpics;
  } else if (typeof rawEpics === 'string') {
    try {
      epics = JSON.parse(rawEpics);
    } catch (e) {
      epics = [];
    }
  }

  // If no epics, seed standard ones
  if (epics.length === 0) {
    epics = [
      { id: `epic-${Date.now()}-0`, title: "Requirements & Architecture Specification", description: "Define scoping, technical requirements, and core interface models." },
      { id: `epic-${Date.now()}-1`, title: "Core Feature Prototype Development", description: "Implement basic functional behaviors and baseline validations." },
      { id: `epic-${Date.now()}-2`, title: "Deployment & Quality Engineering Sync", description: "Conduct end-to-end integration and scale testing." }
    ];
  }

  // Map spoke to board id and label
  const spokeId = project.spoke_id || project.spokeId || "kle-spoke";
  const spokeToBoard = {
    'kle-spoke': '3',
    'coep-spoke': '101',
    'mmcoep-spoke': '102',
    'rit-spoke': '103',
    '3': '3',
    '101': '101',
    '102': '102',
    '103': '103'
  };
  const boardId = spokeToBoard[spokeId] || '3';
  
  const spokeLabels = {
    '3': 'kle-spoke',
    '101': 'coep-spoke',
    '102': 'mmcoep-spoke',
    '103': 'rit-spoke'
  };
  const campusLabel = spokeLabels[boardId] || 'kle-spoke';

  const updatedEpics = [];
  const projectName = project.name || project.title || "Unnamed Project";

  // Define tasks to create per epic
  const epicTasksMap = {
    "Requirements & Architecture Specification": [
      {
        summary: `Define and document functional requirements for ${projectName}`,
        description: `Establish the functional specifications, scope boundaries, and core user flows for the ${projectName} project.`
      },
      {
        summary: `Design database schema and component architecture for ${projectName}`,
        description: `Create the entity relationship diagram (ERD), API endpoints structure, and high-level component diagrams for ${projectName}.`
      },
      {
        summary: `Set up development environment and boilerplate repository`,
        description: `Initialize the git repository, configure linting, CI/CD templates, and prepare backend/frontend boilerplate files for ${projectName}.`
      }
    ],
    "Core Feature Prototype Development": [
      {
        summary: `Implement core backend API services for ${projectName}`,
        description: `Develop controllers, routes, authentication, and core database interactions for the main features of ${projectName}.`
      },
      {
        summary: `Build responsive frontend UI prototype for ${projectName}`,
        description: `Develop user interface components, navigation, layout design, and state management for the user dashboard of ${projectName}.`
      },
      {
        summary: `Integrate frontend with backend services`,
        description: `Connect the frontend API client to the backend REST endpoints and handle state synchronizations and edge errors.`
      }
    ],
    "Deployment & Quality Engineering Sync": [
      {
        summary: `Perform end-to-end integration testing for ${projectName}`,
        description: `Write unit and integration tests, verify core user flows, and optimize query latency for ${projectName}.`
      },
      {
        summary: `Deploy prototype to staging environment`,
        description: `Configure hosting services, environment variables, database connections, and run build commands for ${projectName}.`
      },
      {
        summary: `Prepare final project handover and documentation`,
        description: `Complete technical write-ups, API specs, deployment guides, and prepare the demo walkthrough for ${projectName}.`
      }
    ]
  };

  // 2. Iterate through each Epic, sync it to Jira if not already synced, and auto-create issues
  for (let i = 0; i < epics.length; i++) {
    const epic = epics[i];
    let epicJiraKey = epic.jiraKey;

    if (!epicJiraKey) {
      if (hasJira) {
        try {
          const epicRes = await axios.post(
            `${jiraBase}/rest/api/3/issue`,
            {
              fields: {
                project: { key: jiraProjectKey },
                summary: `[Epic] ${epic.title}`,
                description: epic.description ? {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: epic.description }] }]
                } : undefined,
                issuetype: { name: "Epic" },
                labels: [campusLabel]
              }
            },
            { auth: jiraAuth, headers: jiraHeaders }
          );
          epicJiraKey = epicRes.data.key;
        } catch (epicErr) {
          console.warn(`[Epic creation fallback] Failed to create Epic type for "${epic.title}", falling back to Task type:`, epicErr.message);
          try {
            const epicRes = await axios.post(
              `${jiraBase}/rest/api/3/issue`,
              {
                fields: {
                  project: { key: jiraProjectKey },
                  summary: `[Epic] ${epic.title}`,
                  description: epic.description ? {
                    type: "doc",
                    version: 1,
                    content: [{ type: "paragraph", content: [{ type: "text", text: epic.description }] }]
                  } : undefined,
                  issuetype: { name: "Task" },
                  labels: [campusLabel]
                }
              },
              { auth: jiraAuth, headers: jiraHeaders }
            );
            epicJiraKey = epicRes.data.key;
          } catch (taskErr) {
            console.error("Failed to create Epic completely on Jira, using mock:", taskErr.message);
            epicJiraKey = `${jiraProjectKey}-EPIC-${i + 1}`;
          }
        }
      } else {
        epicJiraKey = `${jiraProjectKey}-EPIC-${i + 1}`;
      }
    }

    const updatedEpic = {
      ...epic,
      jiraKey: epicJiraKey,
      status: epic.status || "To Do"
    };
    updatedEpics.push(updatedEpic);

    // Get specific tasks for this Epic
    const taskTemplates = epicTasksMap[epic.title] || [
      {
        summary: `Automated Task ${1} under ${epic.title} for ${projectName}`,
        description: `Work item for epic ${epic.title} in project ${projectName}`
      },
      {
        summary: `Automated Task ${2} under ${epic.title} for ${projectName}`,
        description: `Work item for epic ${epic.title} in project ${projectName}`
      },
      {
        summary: `Automated Task ${3} under ${epic.title} for ${projectName}`,
        description: `Work item for epic ${epic.title} in project ${projectName}`
      }
    ];

    // Create tasks
    for (let tIdx = 0; tIdx < taskTemplates.length; tIdx++) {
      const template = taskTemplates[tIdx];
      let taskKey = null;
      let taskId = `mock-${boardId}-${Date.now()}-${i}-${tIdx}`;

      if (hasJira) {
        try {
          const taskRes = await axios.post(
            `${jiraBase}/rest/api/3/issue`,
            {
              fields: {
                project: { key: jiraProjectKey },
                summary: template.summary,
                description: {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: template.description }] }]
                },
                parent: { key: epicJiraKey },
                issuetype: { name: "Task" },
                labels: [campusLabel]
              }
            },
            { auth: jiraAuth, headers: jiraHeaders }
          );
          taskKey = taskRes.data.key;
          taskId = taskRes.data.id;
        } catch (tErr) {
          console.warn(`Failed to create task "${template.summary}" in Jira:`, tErr.message);
          taskKey = `${jiraProjectKey}-${100 + i * 10 + tIdx}`;
        }
      } else {
        taskKey = `${jiraProjectKey}-${100 + i * 10 + tIdx}`;
      }

      // Save to mock_tasks in Postgres
      const fields = {
        summary: template.summary,
        description: template.description,
        status: { name: "To Do" },
        priority: { name: "Medium" },
        issuetype: { name: "Task" },
        created: new Date().toISOString(),
        flagged: false,
        parent: {
          key: epicJiraKey,
          summary: epic.title,
          issueType: "Epic"
        }
      };

      try {
        await db.query(
          `INSERT INTO mock_tasks (id, key, board_id, fields)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (key) DO UPDATE SET fields = EXCLUDED.fields`,
          [taskId, taskKey, boardId, JSON.stringify(fields)]
        );
        console.log(`📡 Rovo auto-created task: [${taskKey}] "${template.summary}" under Epic "${epic.title}"`);
      } catch (dbErr) {
        console.error("Failed to insert mock task into PostgreSQL:", dbErr.message);
      }
    }
  }

  // 3. Update the projects table with updated epics (including their JIRA epic keys)
  const cleanProjId = typeof project.id === 'string' ? parseInt(project.id.replace("proj-", "")) : project.id;
  if (!isNaN(cleanProjId)) {
    try {
      await db.query(
        `UPDATE projects 
         SET epics = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(updatedEpics), cleanProjId]
      );
      console.log(`✅ Successfully updated epics list in PostgreSQL database for project ID: ${cleanProjId}`);
    } catch (updateErr) {
      console.error("Failed to update project epics in DB:", updateErr.message);
    }
  }

  return updatedEpics;
}

module.exports = {
  autoCreateJiraProject,
  autoGenerateIssuesForProject
};
