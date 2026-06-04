const db = require('./db');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getJiraBase = () => process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";
const getJiraProject = () => process.env.JIRA_PROJECT_KEY || "SCRUM";
const getJiraAuth = () => ({
  username: process.env.JIRA_EMAIL,
  password: process.env.JIRA_API_TOKEN,
});

const jiraHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Automatically creates a JQL search filter and an Agile Kanban Board in Jira Cloud,
 * and synchronizes the project lead to the Spoke's College SPOC.
 */
async function autoGenerateIssuesForProject(project, jiraProjectKey) {
  const jiraBase = getJiraBase();
  const jiraAuth = getJiraAuth();
  const mainSpaceKey = jiraProjectKey || project.jira_project_key || project.jiraProjectKey || getJiraProject();
  const hasJira = !!(jiraAuth.username && jiraAuth.password);

  const projectId = typeof project.id === 'string' ? parseInt(project.id.replace("proj-", "")) : project.id;
  const projectName = project.name || project.title || "Unnamed Project";
  const spokeId = project.spoke_id || project.spokeId || "kle-spoke";

  console.log(`🤖 Rovo Agent starting automatic board & issue provisioning for project "${projectName}" (ID: ${projectId})`);

  // Map spoke to board id and labels
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
  const projectLabel = `apnileap-proj-${projectId}`;

  let leadAccountId = null;
  let spocEmail = null;
  let spocName = null;

  // 1. Fetch College SPOC details from Database
  try {
    const spocRes = await db.query(
      "SELECT email, name FROM users WHERE college_id = $1 AND role = 'College-SPOC' LIMIT 1",
      [spokeId]
    );
    if (spocRes.rows.length > 0) {
      spocEmail = spocRes.rows[0].email;
      spocName = spocRes.rows[0].name;
      console.log(`👤 Found Spoke College Lead: "${spocName}" (${spocEmail}) for spoke "${spokeId}"`);
    }
  } catch (dbErr) {
    console.error("Failed to fetch College SPOC from DB:", dbErr.message);
  }

  // 2. Resolve Atlassian Account ID for the lead
  if (hasJira) {
    try {
      // Fetch own account ID first as fallback
      const myselfRes = await axios.get(`${jiraBase}/rest/api/3/myself`, {
        auth: jiraAuth,
        headers: { Accept: "application/json" },
        timeout: 5000
      });
      leadAccountId = myselfRes.data.accountId;

      // Try searching for SPOC in Atlassian Directory
      if (spocEmail) {
        console.log(`Searching Atlassian directory for email: ${spocEmail}...`);
        const searchRes = await axios.get(
          `${jiraBase}/rest/api/3/user/search?query=${encodeURIComponent(spocEmail)}`,
          { auth: jiraAuth, headers: { Accept: "application/json" } }
        );
        if (searchRes.data && searchRes.data.length > 0) {
          leadAccountId = searchRes.data[0].accountId;
          console.log(`🎯 Resolved SPOC Atlassian accountId: ${leadAccountId}`);
        } else if (spocName) {
          console.log(`Email search returned no results. Searching for name: ${spocName}...`);
          const searchNameRes = await axios.get(
            `${jiraBase}/rest/api/3/user/search?query=${encodeURIComponent(spocName)}`,
            { auth: jiraAuth, headers: { Accept: "application/json" } }
          );
          if (searchNameRes.data && searchNameRes.data.length > 0) {
            leadAccountId = searchNameRes.data[0].accountId;
            console.log(`🎯 Resolved SPOC Atlassian accountId via name: ${leadAccountId}`);
          }
        }
      }
    } catch (jiraErr) {
      console.warn("Failed to resolve user account ID from Atlassian:", jiraErr.message);
    }
  }

  // 3. Update main Jira space project lead
  if (hasJira && leadAccountId) {
    try {
      console.log(`Setting Jira space (${mainSpaceKey}) project lead to: ${leadAccountId}`);
      await axios.put(
        `${jiraBase}/rest/api/3/project/${mainSpaceKey}`,
        { leadAccountId: leadAccountId },
        { auth: jiraAuth, headers: jiraHeaders }
      );
      console.log(`✅ Successfully set Jira space project lead for key: ${mainSpaceKey}`);
    } catch (leadErr) {
      console.warn(`Failed to update project lead for space ${mainSpaceKey}:`, leadErr.response?.data || leadErr.message);
    }
  }

  // 4. Create JQL Filter & Kanban Board in Jira Cloud
  let jiraBoardId = null;
  let jiraBoardUrl = null;

  if (hasJira) {
    try {
      // A. Create the search filter
      console.log(`Creating JQL search filter for board...`);
      const filterRes = await axios.post(
        `${jiraBase}/rest/api/3/filter`,
        {
          name: `Filter for ${projectName} [APNILEAP]`,
          jql: `project = ${mainSpaceKey} AND labels = '${projectLabel}'`,
          description: `Auto-generated search filter for project board ${projectName}`
        },
        { auth: jiraAuth, headers: jiraHeaders }
      );
      const filterId = filterRes.data.id;
      console.log(`Filter created successfully. ID: ${filterId}`);

      // B. Create the Kanban Board
      console.log(`Creating Kanban Board for project: ${projectName}...`);
      const boardRes = await axios.post(
        `${jiraBase}/rest/agile/1.0/board`,
        {
          name: `${projectName} Board`,
          type: "kanban",
          filterId: filterId
        },
        { auth: jiraAuth, headers: jiraHeaders }
      );
      jiraBoardId = boardRes.data.id;
      jiraBoardUrl = `${jiraBase}/secure/RapidBoard.jspa?rapidView=${jiraBoardId}`;
      console.log(`✅ Successfully created Kanban Board! ID: ${jiraBoardId}, Link: ${jiraBoardUrl}`);
    } catch (boardErr) {
      console.error("Failed to automatically provision Jira Filter or Board:", boardErr.response?.data || boardErr.message);
    }
  }

  // Fallback board configurations if offline or failed
  if (!jiraBoardId) {
    jiraBoardId = 100 + Math.floor(Math.random() * 900);
    jiraBoardUrl = `${jiraBase}/secure/RapidBoard.jspa?rapidView=${jiraBoardId}`;
  }

  // Update project board details in local database
  project.jira_board_url = jiraBoardUrl;
  project.jiraBoardUrl = jiraBoardUrl;
  try {
    await db.query(
      `UPDATE projects 
       SET jira_board_url = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [jiraBoardUrl, projectId]
    );
  } catch (dbErr) {
    console.error("Failed to update project board url in DB:", dbErr.message);
  }

  // 5. Get or create the Epics list
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

  if (epics.length === 0) {
    epics = [
      { id: `epic-${Date.now()}-0`, title: "Requirements & Architecture Specification", description: "Define scoping, technical requirements, and core interface models." },
      { id: `epic-${Date.now()}-1`, title: "Core Feature Prototype Development", description: "Implement basic functional behaviors and baseline validations." },
      { id: `epic-${Date.now()}-2`, title: "Deployment & Quality Engineering Sync", description: "Conduct end-to-end integration and scale testing." }
    ];
  }

  const updatedEpics = [];

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

  // 6. Iterate through Epics, sync to Jira under main space, and create Tasks under "To Do"
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
                project: { key: mainSpaceKey },
                summary: `[Epic] ${epic.title}`,
                description: epic.description ? {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: epic.description }] }]
                } : undefined,
                issuetype: { name: "Epic" },
                labels: [campusLabel, projectLabel]
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
                  project: { key: mainSpaceKey },
                  summary: `[Epic] ${epic.title}`,
                  description: epic.description ? {
                    type: "doc",
                    version: 1,
                    content: [{ type: "paragraph", content: [{ type: "text", text: epic.description }] }]
                  } : undefined,
                  issuetype: { name: "Task" },
                  labels: [campusLabel, projectLabel]
                }
              },
              { auth: jiraAuth, headers: jiraHeaders }
            );
            epicJiraKey = epicRes.data.key;
          } catch (taskErr) {
            console.error("Failed to create Epic completely on Jira, using mock:", taskErr.message);
            epicJiraKey = `${mainSpaceKey}-EPIC-${i + 1}`;
          }
        }
      } else {
        epicJiraKey = `${mainSpaceKey}-EPIC-${i + 1}`;
      }
    }

    const updatedEpic = {
      ...epic,
      jiraKey: epicJiraKey,
      status: "To Do"
    };
    updatedEpics.push(updatedEpic);

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

    // Create tasks under "To Do"
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
                project: { key: mainSpaceKey },
                summary: template.summary,
                description: {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: template.description }] }]
                },
                parent: { key: epicJiraKey },
                issuetype: { name: "Task" },
                labels: [campusLabel, projectLabel]
              }
            },
            { auth: jiraAuth, headers: jiraHeaders }
          );
          taskKey = taskRes.data.key;
          taskId = taskRes.data.id;
        } catch (tErr) {
          console.warn(`Failed to create task "${template.summary}" in Jira:`, tErr.message);
          taskKey = `${mainSpaceKey}-${100 + i * 10 + tIdx}`;
        }
      } else {
        taskKey = `${mainSpaceKey}-${100 + i * 10 + tIdx}`;
      }

      // Save to mock_tasks in Postgres (with status "To Do")
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
        console.log(`📡 Rovo auto-created task under To Do: [${taskKey}] "${template.summary}" under Epic "${epic.title}"`);
      } catch (dbErr) {
        console.error("Failed to insert mock task into PostgreSQL:", dbErr.message);
      }
    }
  }

  // Update the projects table with updated epics (including their JIRA epic keys and status as "To Do")
  if (!isNaN(projectId)) {
    try {
      await db.query(
        `UPDATE projects 
         SET epics = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(updatedEpics), projectId]
      );
      console.log(`✅ Successfully updated epics list in PostgreSQL database for project ID: ${projectId}`);
    } catch (updateErr) {
      console.error("Failed to update project epics in DB:", updateErr.message);
    }
  }

  return updatedEpics;
}

module.exports = {
  autoGenerateIssuesForProject
};
