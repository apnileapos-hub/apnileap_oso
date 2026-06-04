const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_jwt_secret";

// JWT token validation middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access Denied: Secure JWT authorization token required." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn("[AUTH FAILURE] Invalid or expired JWT token received.");
      return res.status(403).json({ error: "Access Denied: Invalid or expired session token." });
    }
    req.user = user;
    next();
  });
}

// SPOKES Mapping
const SPOKES = {
  "3": { name: "KLE Spoke", key: "AK", live: true, boardId: 75 },
  "101": { name: "COEP Spoke", key: "AK", live: true, boardId: 76 },
  "102": { name: "MMCOEP Spoke", key: "AK", live: true, boardId: 77 },
  "103": { name: "RIT Spoke", key: "AK", live: true, boardId: 78 },
};

const LIVE_BOARD_IDS = Object.values(SPOKES).filter(s => s.live).map(s => s.boardId);

const CAMPUS_LABELS = {
  "3": "kle-spoke",
  "101": "coep-spoke",
  "102": "mmcoep-spoke",
  "103": "rit-spoke"
};

const CAMPUS_TEAM_MEMBERS = {
  "3": [
    { accountId: "mock-kle-1", displayName: "Rahul Sharma (Student Developer)", emailAddress: "rahul@kle.edu", email: "rahul@kle.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=12" } },
    { accountId: "mock-kle-2", displayName: "Priya Patel (Student Developer)", emailAddress: "priya@kle.edu", email: "priya@kle.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=47" } },
    { accountId: "mock-kle-3", displayName: "Prof. Deshpande (Faculty Mentor)", emailAddress: "mentor@kle.edu", email: "mentor@kle.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=63" } }
  ],
  "101": [
    { accountId: "mock-coep-1", displayName: "Sneha Joshi (Student Developer)", emailAddress: "sneha@coep.edu", email: "sneha@coep.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=35" } },
    { accountId: "mock-coep-2", displayName: "Amit Waghmare (Student Developer)", emailAddress: "amit@coep.edu", email: "amit@coep.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=11" } }
  ],
  "102": [
    { accountId: "mock-mmcoep-1", displayName: "Nikhil Rane (Student Developer)", emailAddress: "nikhil@mmcoep.edu", email: "nikhil@mmcoep.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=33" } },
    { accountId: "mock-mmcoep-2", displayName: "Sayali Deshmukh (Student Developer)", emailAddress: "sayali@mmcoep.edu", email: "sayali@mmcoep.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=49" } }
  ],
  "103": [
    { accountId: "mock-rit-1", displayName: "Tejas Shinde (Student Developer)", emailAddress: "tejas@rit.edu", email: "tejas@rit.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=15" } },
    { accountId: "mock-rit-2", displayName: "Priti Patil (Student Developer)", emailAddress: "priti@rit.edu", email: "priti@rit.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=45" } }
  ]
};

const STUDENT_DEVELOPERS = [
  { accountId: "mock-kle-student", displayName: "KLE Student Developer", emailAddress: "student@kle.edu", email: "student@kle.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=12" } },
  { accountId: "mock-coep-student", displayName: "COEP Student Developer", emailAddress: "student@coep.edu", email: "student@coep.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=35" } },
  { accountId: "mock-rit-student", displayName: "RIT Student Developer", emailAddress: "student@rit.edu", email: "student@rit.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=15" } }
];

const MOCK_ASSIGNEES = [
  { accountId: "mock-1", displayName: "Manasa Vasare (Coordinator)", emailAddress: "coordinator@kle.edu", email: "coordinator@kle.edu", avatarUrls: { "48x48": "https://i.pravatar.cc/150?img=32" } },
  ...STUDENT_DEVELOPERS,
  ...CAMPUS_TEAM_MEMBERS["3"],
  ...CAMPUS_TEAM_MEMBERS["101"],
  ...CAMPUS_TEAM_MEMBERS["102"],
  ...CAMPUS_TEAM_MEMBERS["103"],
];

// Simulated Assignee Store in-memory cache matching user team's logic
let jiraSimulatedAssigneeStore = {};

// Helpers to dynamically resolve JIRA Base URL and basic Auth headers
const getJiraBaseUrl = () => {
  return process.env.JIRA_DOMAIN || process.env.JIRA_BASE_URL || "https://apnileapos.atlassian.net";
};

const getJiraAuthHeader = () => {
  const email = process.env.JIRA_EMAIL || "";
  const token = process.env.JIRA_API_TOKEN || "";
  return Buffer.from(`${email}:${token}`).toString("base64");
};

// Simple helper to check if JIRA credentials are configured and we should talk to live JIRA
const shouldCheckJira = () => {
  return !!(process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
};

// GET /tasks: Retrieve tasks for a board
router.get("/tasks", async (req, res) => {
  const boardId = req.query.boardId || "3";
  const spoke = SPOKES[boardId];
  const JIRA_BASE = getJiraBaseUrl();
  const authBase64 = getJiraAuthHeader();

  if (spoke && spoke.live && shouldCheckJira()) {
    try {
      const response = await axios.get(
        `${JIRA_BASE}/rest/agile/1.0/board/${spoke.boardId}/issue`,
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
          },
          timeout: 10000
        }
      );

      let issues = response.data.issues || [];

      // Filter by spoke labels
      if (LIVE_BOARD_IDS.includes(spoke.boardId)) {
        issues = issues.filter(issue => {
          const labels = issue.fields?.labels || [];
          if (boardId === "3") {
            return labels.includes("kle-spoke") || (!labels.includes("rit-spoke") && !labels.includes("coep-spoke") && !labels.includes("mmcoep-spoke"));
          } else {
            return labels.includes(CAMPUS_LABELS[boardId]);
          }
        });
      }

      // Map simulated assignees overlay
      issues = issues.map(issue => {
        const simulated = jiraSimulatedAssigneeStore[issue.key];
        if (simulated) {
          return {
            ...issue,
            fields: {
              ...issue.fields,
              assignee: {
                accountId: simulated.accountId,
                displayName: simulated.displayName,
                avatarUrls: { "48x48": simulated.avatarUrl },
                emailAddress: simulated.emailAddress || ""
              }
            }
          };
        }
        return issue;
      });

      // Map issue structure to standard expected shape
      const mappedIssues = issues.map(issue => ({
        id: issue.id,
        key: issue.key,
        fields: {
          summary: issue.fields?.summary || "",
          description: issue.fields?.description?.content?.[0]?.content?.[0]?.text || issue.fields?.description || "",
          status: { name: issue.fields?.status?.name || "To Do" },
          priority: { name: issue.fields?.priority?.name || "Medium" },
          issuetype: { name: issue.fields?.issuetype?.name || "Task" },
          created: issue.fields?.created,
          dueDate: issue.fields?.duedate,
          flagged: (issue.fields?.customfield_10021 && issue.fields.customfield_10021.length > 0) ? true : false,
          labels: issue.fields?.labels || [],
          assignee: issue.fields?.assignee ? {
            accountId: issue.fields.assignee.accountId,
            displayName: issue.fields.assignee.displayName,
            avatarUrl: issue.fields.assignee.avatarUrls?.["48x48"] || "https://i.pravatar.cc/150",
            email: issue.fields.assignee.emailAddress || ""
          } : null,
          subtasks: (issue.fields?.subtasks || []).map(st => ({
            id: st.id,
            key: st.key,
            summary: st.fields?.summary || "",
            statusName: st.fields?.status?.name || "To Do"
          })),
          parent: issue.fields?.parent ? {
            key: issue.fields.parent.key,
            summary: issue.fields.parent.fields?.summary,
            issueType: issue.fields.parent.fields?.issuetype?.name
          } : null
        }
      }));

      return res.json(mappedIssues);
    } catch (err) {
      console.warn(`JIRA Board fetch failed, falling back to mock tasks database:`, err.message);
    }
  }

  // Fallback to Postgres mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE board_id = $1 ORDER BY created_at DESC', [boardId]);
    const mockTasks = result.rows.map(row => ({
      id: row.id,
      key: row.key,
      fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields
    }));
    res.json(mockTasks);
  } catch (error) {
    console.error("Failed to fetch mock tasks:", error);
    res.status(500).json({ error: "Failed to fetch mock tasks" });
  }
});

// GET /myself: Retrieve authenticated Jira profile details
router.get("/myself", async (req, res) => {
  const JIRA_BASE = getJiraBaseUrl();
  const authBase64 = getJiraAuthHeader();

  if (shouldCheckJira()) {
    try {
      const response = await axios.get(
        `${JIRA_BASE}/rest/api/2/myself`,
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
          },
          timeout: 10000
        }
      );
      return res.json(response.data);
    } catch (error) {
      console.warn("Jira Myself Fetch Error, falling back to mock profile:", error.message);
    }
  }

  // Fallback profile
  const mockProfile = {
    accountId: "admin-mock-id",
    displayName: "apnileapos (Offline)",
    emailAddress: process.env.JIRA_EMAIL || "apnileapos@gmail.com",
    avatarUrls: {
      "48x48": "https://i.pravatar.cc/150?img=68"
    },
    active: true,
    timeZone: "Asia/Kolkata"
  };
  res.json(mockProfile);
});

// POST /tasks: Create a new task
router.post("/tasks", verifyToken, async (req, res) => {
  const { summary, description, statusName, priorityName, assigneeId, reporterId, dueDate, issueTypeName, boardId, parentId, parentKey, parentSummary } = req.body;
  const targetBoardId = boardId || "3";
  const spoke = SPOKES[targetBoardId];

  // Resolve assigned user object details
  let assignedUserObj = null;
  if (assigneeId) {
    assignedUserObj = MOCK_ASSIGNEES.find(a => a.accountId === assigneeId);
    if (!assignedUserObj) {
      // Query users table if assigneeId matches database user email
      try {
        const userCheck = await db.query('SELECT name, email, role FROM users WHERE id::text = $1 OR email = $2', [assigneeId, assigneeId]);
        if (userCheck.rows.length > 0) {
          const dbUser = userCheck.rows[0];
          assignedUserObj = {
            accountId: assigneeId,
            displayName: `${dbUser.name} (${dbUser.role})`,
            emailAddress: dbUser.email,
            avatarUrls: { "48x48": `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser.name)}&background=6366f1&color=fff` }
          };
        }
      } catch (err) {
        console.error("Failed to query DB user for assignee resolution:", err.message);
      }
    }
    if (!assignedUserObj) {
      assignedUserObj = {
        accountId: assigneeId,
        displayName: "Team Member",
        avatarUrls: { "48x48": "https://i.pravatar.cc/150" }
      };
    }
  }

  let reporterUserObj = null;
  if (reporterId) {
    reporterUserObj = MOCK_ASSIGNEES.find(a => a.accountId === reporterId);
    if (!reporterUserObj) {
      reporterUserObj = {
        accountId: reporterId,
        displayName: "Reporter",
        avatarUrls: { "48x48": "https://i.pravatar.cc/150" }
      };
    }
  }

  // Live JIRA Create logic
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();

    try {
      // 1. Determine target project key by querying active board issues list
      const boardIssuesRes = await axios.get(
        `${JIRA_BASE}/rest/agile/1.0/board/${spoke.boardId}/issue`,
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
          },
        }
      );
      const issues = boardIssuesRes.data.issues || [];
      const projectKey = issues.length > 0 ? issues[0].fields.project.key : (process.env.JIRA_PROJECT_KEY || "KAN");

      // 2. Build JIRA payload
      const fields = {
        project: { key: projectKey },
        summary: summary || "Sprint Task",
        issuetype: { name: issueTypeName || "Task" },
        labels: [CAMPUS_LABELS[targetBoardId] || "kle-spoke"]
      };

      if (description !== undefined) fields.description = description;
      if (dueDate) fields.duedate = dueDate;
      if (priorityName) fields.priority = { name: priorityName };

      if (assigneeId) {
        if (assigneeId.startsWith("mock-") || assigneeId.includes("@")) {
          // Bypass live JIRA mapping validation
          fields.assignee = null;
        } else {
          fields.assignee = { accountId: assigneeId };
        }
      }

      // Add parent Epic if specified
      if (parentId || parentKey) {
        fields.parent = { key: parentKey || parentId };
      }

      // 3. Post to create issue in JIRA
      const response = await axios.post(
        `${JIRA_BASE}/rest/api/2/issue`,
        { fields },
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
            "Content-Type": "application/json"
          }
        }
      );

      const newIssueKey = response.data.key;
      const newIssueId = response.data.id;

      // Overlay mock assignee in store post-creation
      if (assigneeId && (assigneeId.startsWith("mock-") || assigneeId.includes("@"))) {
        if (assignedUserObj) {
          jiraSimulatedAssigneeStore[newIssueKey] = {
            accountId: assignedUserObj.accountId,
            displayName: assignedUserObj.displayName,
            avatarUrl: assignedUserObj.avatarUrls?.["48x48"] || "https://i.pravatar.cc/150",
            emailAddress: assignedUserObj.emailAddress || ""
          };
        }
      }

      return res.json({ success: true, key: newIssueKey, id: newIssueId });
    } catch (error) {
      console.error("Live Jira Create Task Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const taskId = `mock-${targetBoardId}-${Date.now()}`;
    const key = spoke ? `${spoke.key}-${Math.floor(Math.random() * 1000) + 100}` : `MOCK-${Date.now()}`;

    const fields = {
      summary: summary || "Sprint Task",
      description: description || "",
      status: { name: statusName || "Backlog" },
      priority: { name: priorityName || "Medium" },
      issuetype: { name: issueTypeName || "Task" },
      assignee: assignedUserObj,
      reporter: reporterUserObj,
      created: new Date().toISOString(),
      duedate: dueDate || null,
      customfield_10021: null,
      subtasks: [],
      issuelinks: [],
      labels: parentId ? ["B2B-Task", CAMPUS_LABELS[targetBoardId] || "kle-spoke"] : [],
      parent: parentId ? {
        id: parentId,
        key: parentKey,
        summary: parentSummary,
        issueType: "Epic"
      } : null
    };

    await db.query(
      `INSERT INTO mock_tasks (id, key, board_id, fields) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET fields = EXCLUDED.fields, updated_at = NOW()`,
      [taskId, key, targetBoardId, JSON.stringify(fields)]
    );

    res.json({ success: true, key, id: taskId });
  } catch (error) {
    console.error("Failed to create mock task:", error);
    res.status(500).json({ error: "Failed to create mock task" });
  }
});

// PUT /tasks/:key: Update fields of a mock task in PostgreSQL or JIRA
router.put("/tasks/:key", verifyToken, async (req, res) => {
  const { key } = req.params;
  const { summary, description, dueDate, assignee, reporter, priority } = req.body;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  // Resolve assigned user object details
  let assignedUserObj = null;
  if (assignee !== undefined && assignee !== null) {
    assignedUserObj = MOCK_ASSIGNEES.find(a => a.accountId === assignee);
    if (!assignedUserObj) {
      try {
        const userCheck = await db.query('SELECT name, email, role FROM users WHERE id::text = $1 OR email = $2', [assignee, assignee]);
        if (userCheck.rows.length > 0) {
          const dbUser = userCheck.rows[0];
          assignedUserObj = {
            accountId: assignee,
            displayName: `${dbUser.name} (${dbUser.role})`,
            emailAddress: dbUser.email,
            avatarUrls: { "48x48": `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser.name)}&background=6366f1&color=fff` }
          };
        }
      } catch (err) {
        console.error("Failed to query DB user for assignee resolution:", err.message);
      }
    }
    if (!assignedUserObj) {
      assignedUserObj = {
        accountId: assignee,
        displayName: "Team Member",
        avatarUrls: { "48x48": "https://i.pravatar.cc/150" }
      };
    }
  }

  let reporterUserObj = null;
  if (reporter !== undefined && reporter !== null) {
    reporterUserObj = MOCK_ASSIGNEES.find(a => a.accountId === reporter);
    if (!reporterUserObj) {
      reporterUserObj = {
        accountId: reporter,
        displayName: "Reporter",
        avatarUrls: { "48x48": "https://i.pravatar.cc/150" }
      };
    }
  }

  // Live JIRA Update logic
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();

    const fields = {};
    if (summary !== undefined) fields.summary = summary;
    if (description !== undefined) fields.description = description;
    if (dueDate !== undefined) fields.duedate = dueDate === "" ? null : dueDate;
    if (priority !== undefined) fields.priority = priority ? { name: priority } : null;

    if (assignee !== undefined) {
      if (assignee && (assignee.startsWith("mock-") || assignee.includes("@"))) {
        if (assignedUserObj) {
          jiraSimulatedAssigneeStore[key] = {
            accountId: assignedUserObj.accountId,
            displayName: assignedUserObj.displayName,
            avatarUrl: assignedUserObj.avatarUrls?.["48x48"] || "https://i.pravatar.cc/150",
            emailAddress: assignedUserObj.emailAddress
          };
        }
        fields.assignee = null;
      } else {
        delete jiraSimulatedAssigneeStore[key];
        fields.assignee = assignee ? { accountId: assignee } : null;
      }
    }

    try {
      await axios.put(
        `${JIRA_BASE}/rest/api/2/issue/${key}`,
        { fields },
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
            "Content-Type": "application/json"
          }
        }
      );
      return res.json({ success: true, message: `Updated issue ${key} successfully` });
    } catch (error) {
      console.error("Live Jira Update Task Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    let taskFields = {};
    let isNew = false;
    let taskId = `mock-${spoke ? spoke.boardId : "3"}-${Date.now()}`;

    if (result.rows.length === 0) {
      isNew = true;
      taskFields = {
        summary: summary || "Sprint Task",
        description: description || "",
        status: { name: "Backlog" },
        priority: { name: priority || "Medium" },
        issuetype: { name: "Task" },
        assignee: assignee ? assignedUserObj : null,
        reporter: reporter ? reporterUserObj : null,
        created: new Date().toISOString(),
        duedate: dueDate === "" ? null : dueDate,
        subtasks: [],
        issuelinks: [],
        labels: []
      };
    } else {
      taskId = result.rows[0].id;
      taskFields = typeof result.rows[0].fields === 'string' ? JSON.parse(result.rows[0].fields) : result.rows[0].fields;
      if (summary !== undefined) taskFields.summary = summary;
      if (description !== undefined) taskFields.description = description;
      if (dueDate !== undefined) taskFields.duedate = dueDate === "" ? null : dueDate;
      if (priority !== undefined) taskFields.priority = { name: priority };
      if (assignee !== undefined) taskFields.assignee = assignee ? assignedUserObj : null;
      if (reporter !== undefined) taskFields.reporter = reporter ? reporterUserObj : null;
    }

    if (isNew) {
      await db.query(
        `INSERT INTO mock_tasks (id, key, board_id, fields) 
         VALUES ($1, $2, $3, $4)`,
        [taskId, key, spoke ? spoke.boardId : "3", JSON.stringify(taskFields)]
      );
    } else {
      await db.query(
        `UPDATE mock_tasks SET fields = $1, updated_at = NOW() WHERE key = $2`,
        [JSON.stringify(taskFields), key]
      );
    }

    res.json({ success: true, task: { id: taskId, key, boardId: spoke ? spoke.boardId : "3", fields: taskFields } });
  } catch (error) {
    console.error("Failed to update task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// POST /tasks/:key/transition: Transition task status
router.post("/tasks/:key/transition", async (req, res) => {
  const { key } = req.params;
  const statusName = req.body.status || req.body.statusName;

  if (!statusName) {
    return res.status(400).json({ error: "Status or statusName is required" });
  }

  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  // Live JIRA Transition logic
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();

    try {
      // 1. Fetch available transitions
      const transRes = await axios.get(
        `${JIRA_BASE}/rest/api/3/issue/${key}/transitions`,
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
          }
        }
      );
      const transitions = transRes.data.transitions || [];

      // 2. Match transition destination status name case-insensitively
      const match = transitions.find(t => 
        t.name.toLowerCase() === statusName.toLowerCase() ||
        t.to.name.toLowerCase() === statusName.toLowerCase()
      );

      if (match) {
        // 3. Post transition execution
        await axios.post(
          `${JIRA_BASE}/rest/api/3/issue/${key}/transitions`,
          { transition: { id: match.id } },
          {
            headers: {
              Authorization: `Basic ${authBase64}`,
              Accept: "application/json",
              "Content-Type": "application/json"
            }
          }
        );
        return res.json({ success: true, message: `Transitioned issue ${key} to ${statusName} successfully.` });
      } else {
        console.warn(`No matching active transition path in Jira for status: ${statusName}`);
      }
    } catch (error) {
      console.error("Live Jira Transition Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = result.rows[0];
    const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
    fields.status = { name: statusName };

    await db.query(
      'UPDATE mock_tasks SET fields = $1, updated_at = NOW() WHERE key = $2',
      [JSON.stringify(fields), key]
    );

    res.json({ success: true, message: `Successfully transitioned to ${statusName}` });
  } catch (error) {
    console.error("Failed to transition task:", error);
    res.status(500).json({ error: "Failed to transition task" });
  }
});

// DELETE /tasks/:key: Delete a task
router.delete("/tasks/:key", verifyToken, async (req, res) => {
  const { key } = req.params;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  // Live JIRA Delete logic
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();

    try {
      await axios.delete(
        `${JIRA_BASE}/rest/api/2/issue/${key}`,
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
          }
        }
      );
      return res.json({ success: true, message: `Deleted issue ${key} from Jira successfully.` });
    } catch (error) {
      console.error("Live Jira Delete Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('DELETE FROM mock_tasks WHERE key = $1 RETURNING *', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    console.error("Failed to delete task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// PUT /tasks/:key/flag: Toggle Standard Jira Impediment Flag status
router.put("/tasks/:key/flag", async (req, res) => {
  const { key } = req.params;
  const { flagged } = req.body;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  // Live JIRA Flagging logic
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();
    const fields = {
      customfield_10021: flagged ? [{ value: "Impediment" }] : null
    };

    try {
      await axios.put(
        `${JIRA_BASE}/rest/api/2/issue/${key}`,
        { fields },
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
            "Content-Type": "application/json"
          }
        }
      );
      return res.json({ success: true, message: `Successfully updated impediment flag for issue ${key}` });
    } catch (error) {
      console.error("Live Jira Flag Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = result.rows[0];
    const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
    fields.flagged = flagged;

    await db.query(
      'UPDATE mock_tasks SET fields = $1, updated_at = NOW() WHERE key = $2',
      [JSON.stringify(fields), key]
    );

    res.json({ success: true, message: `Successfully updated impediment flag for mock issue ${key}` });
  } catch (error) {
    console.error("Failed to flag task:", error);
    res.status(500).json({ error: "Failed to flag task" });
  }
});

// PUT /tasks/:key/labels: Update custom labels list for a ticket
router.put("/tasks/:key/labels", async (req, res) => {
  const { key } = req.params;
  const { labels } = req.body;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  // Live JIRA Labels logic
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();

    try {
      await axios.put(
        `${JIRA_BASE}/rest/api/2/issue/${key}`,
        { fields: { labels } },
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
            "Content-Type": "application/json"
          }
        }
      );
      return res.json({ success: true, message: `Successfully updated labels for issue ${key}` });
    } catch (error) {
      console.error("Live Jira Labels Update Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = result.rows[0];
    const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
    fields.labels = labels;

    await db.query(
      'UPDATE mock_tasks SET fields = $1, updated_at = NOW() WHERE key = $2',
      [JSON.stringify(fields), key]
    );

    res.json({ success: true, message: `Successfully updated labels for mock issue ${key}` });
  } catch (error) {
    console.error("Failed to update labels:", error);
    res.status(500).json({ error: "Failed to update labels" });
  }
});

// POST /tasks/:key/worklog: Log spent time
router.post("/tasks/:key/worklog", async (req, res) => {
  const { key } = req.params;
  const { timeSpent, comment } = req.body;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  // Live JIRA Worklog logic
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();

    try {
      await axios.post(
        `${JIRA_BASE}/rest/api/2/issue/${key}/worklog`,
        {
          timeSpent,
          comment: comment || "Logged spent hours via ApniLeap Agile Dashboard"
        },
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
            "Content-Type": "application/json"
          }
        }
      );
      return res.json({ success: true, message: `Successfully logged ${timeSpent} to issue ${key}` });
    } catch (error) {
      console.error("Live Jira Worklog Post Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = result.rows[0];
    const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;

    if (!fields.worklogs) fields.worklogs = [];
    fields.worklogs.push({
      id: `mock-wl-${Date.now()}`,
      timeSpent,
      comment: comment || "Logged spent hours via ApniLeap Agile Dashboard",
      created: new Date().toISOString(),
      author: MOCK_ASSIGNEES[0]
    });

    if (!fields.timetracking) {
      fields.timetracking = { timeSpentSeconds: 0 };
    }
    fields.timetracking.timeSpent = timeSpent;
    fields.timetracking.timeSpentSeconds = (fields.timetracking.timeSpentSeconds || 0) + 7200;

    await db.query(
      'UPDATE mock_tasks SET fields = $1, updated_at = NOW() WHERE key = $2',
      [JSON.stringify(fields), key]
    );

    res.json({ success: true, message: `Successfully logged ${timeSpent} to mock issue ${key}` });
  } catch (error) {
    console.error("Failed to post worklog:", error);
    res.status(500).json({ error: "Failed to post worklog" });
  }
});

// GET /tasks/:key/worklog: Retrieve worklog history
router.get("/tasks/:key/worklog", async (req, res) => {
  const { key } = req.params;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  // Live JIRA Worklog list
  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();

    try {
      const response = await axios.get(
        `${JIRA_BASE}/rest/api/2/issue/${key}/worklog`,
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json"
          }
        }
      );
      return res.json(response.data.worklogs || []);
    } catch (error) {
      console.error("Live Jira Worklog Get Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('SELECT fields FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.json([]);
    }
    const fields = typeof result.rows[0].fields === 'string' ? JSON.parse(result.rows[0].fields) : result.rows[0].fields;
    res.json(fields.worklogs || []);
  } catch (error) {
    console.error("Failed to fetch worklogs:", error);
    res.status(500).json({ error: "Failed to fetch worklogs" });
  }
});

// POST /tasks/:key/subtask: Create child subtask inside Jira or PostgreSQL
router.post("/tasks/:key/subtask", verifyToken, async (req, res) => {
  const { key } = req.params;
  const { summary, assigneeId, parentIssueType } = req.body;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  if (!spoke) {
    return res.status(400).json({ error: "Invalid task key context. Spoke project not found." });
  }

  // Live JIRA Subtask logic
  if (spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();
    const isEpic = parentIssueType && parentIssueType.toLowerCase() === "epic";
    const issueTypeName = isEpic ? "Task" : "Sub-task";

    const fields = {
      project: { key: projectKey },
      parent: { key },
      summary,
      issuetype: { name: issueTypeName }
    };

    if (assigneeId) {
      if (assigneeId.startsWith("mock-") || assigneeId.includes("@")) {
        fields.assignee = null;
      } else {
        fields.assignee = { accountId: assigneeId };
      }
    }

    try {
      const response = await axios.post(
        `${JIRA_BASE}/rest/api/2/issue`,
        { fields },
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
            "Content-Type": "application/json"
          }
        }
      );
      return res.json({ success: true, key: response.data.key, id: response.data.id });
    } catch (error) {
      console.error("Live Jira Create Subtask Error:", error.response?.data || error.message);
    }
  }

  // Fallback to PostgreSQL mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Mock parent task not found" });
    }

    const parentTask = result.rows[0];
    const parentFields = typeof parentTask.fields === 'string' ? JSON.parse(parentTask.fields) : parentTask.fields;

    const isEpic = parentIssueType && parentIssueType.toLowerCase() === "epic";
    const issueTypeName = isEpic ? "Task" : "Sub-task";

    const newIndex = Math.floor(Math.random() * 1000) + 100;
    const newKey = `${projectKey}-${newIndex}`;
    const newId = `mock-sub-${Date.now()}`;

    const newChildFields = {
      summary,
      description: "",
      status: { name: "Backlog" },
      priority: { name: "Medium" },
      issuetype: { name: issueTypeName },
      assignee: assigneeId ? MOCK_ASSIGNEES.find(a => a.accountId === assigneeId) || null : null,
      reporter: MOCK_ASSIGNEES[0],
      created: new Date().toISOString(),
      duedate: null,
      subtasks: [],
      issuelinks: [],
      parent: {
        id: parentTask.id,
        key: parentTask.key,
        fields: {
          summary: parentFields.summary,
          issuetype: { name: parentFields.issuetype?.name || "Task" }
        }
      }
    };

    // Insert child task
    await db.query(
      `INSERT INTO mock_tasks (id, key, board_id, fields) 
       VALUES ($1, $2, $3, $4)`,
      [newId, newKey, parentTask.board_id, JSON.stringify(newChildFields)]
    );

    // Update parent's subtasks list
    if (!isEpic) {
      if (!parentFields.subtasks) parentFields.subtasks = [];
      parentFields.subtasks.push({
        id: newId,
        key: newKey,
        summary: summary,
        statusName: "Backlog"
      });
      await db.query(
        'UPDATE mock_tasks SET fields = $1 WHERE key = $2',
        [JSON.stringify(parentFields), key]
      );
    }

    res.json({ success: true, key: newKey, id: newId });
  } catch (error) {
    console.error("Failed to create mock subtask:", error);
    res.status(500).json({ error: "Failed to create mock subtask" });
  }
});

// POST /tasks/links: Link issues in Jira
router.post("/tasks/links", async (req, res) => {
  const { linkType, sourceKey, targetKey } = req.body;
  const projectKey = sourceKey.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  if (spoke && spoke.live && shouldCheckJira()) {
    const JIRA_BASE = getJiraBaseUrl();
    const authBase64 = getJiraAuthHeader();
    let inwardKey = linkType === "blocks" ? targetKey : sourceKey;
    let outwardKey = linkType === "blocks" ? sourceKey : targetKey;

    try {
      await axios.post(
        `${JIRA_BASE}/rest/api/2/issueLink`,
        {
          type: { name: "Blocks" },
          inwardIssue: { key: inwardKey },
          outwardIssue: { key: outwardKey }
        },
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            Accept: "application/json",
            "Content-Type": "application/json"
          }
        }
      );
      return res.json({ success: true, message: `Successfully linked board issues` });
    } catch (error) {
      console.error("Live Jira Link Issues Error:", error.response?.data || error.message);
    }
  }

  res.json({ success: true, message: `Successfully linked board issues in mock workspace` });
});

// POST /tasks/send-reminder: SMTP Email Gateway for Task Reminders
router.post("/tasks/send-reminder", async (req, res) => {
  const { recipient, subject, taskKey, taskSummary, dueDate, message } = req.body;

  if (!recipient || !subject || !message) {
    return res.status(400).json({ success: false, error: "Missing required email headers or body." });
  }

  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  try {
    let transporter;
    let info;
    let isTestAccount = false;

    if (hasSmtpConfig) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      isTestAccount = true;
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const redirectEmail = process.env.SMTP_REDIRECT_TO || null;
    const finalTo = redirectEmail ? redirectEmail : recipient;

    const redirectBannerHtml = redirectEmail ? `
      <div style="background: rgba(251, 146, 60, 0.08); border: 1px dashed rgba(251, 146, 60, 0.25); border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #fb923c; text-align: center; line-height: 1.5;">
        ⚙️ <strong>[Demo Rerouting Mode Active]</strong><br/>
        This email was originally addressed to: <span style="font-family: monospace; font-weight: 750; color: #f97316;">${recipient}</span>.<br/>
        It has been rerouted to your administrator address (<strong style="color: white;">${redirectEmail}</strong>) for live verification.
      </div>
    ` : "";

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #07090e; padding: 40px; color: #f3f4f6; min-height: 100%;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(17, 24, 39, 0.9); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -1px; color: white;">ApniLeap JiraPro</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #e0e7ff;">⚠️ Urgent Sprint Deadline Alert</p>
          </div>
          <div style="padding: 40px 30px; line-height: 1.6;">
            ${redirectBannerHtml}
            <h2 style="margin-top: 0; color: white; font-size: 18px; font-weight: 700;">Attention Team Member,</h2>
            <p style="font-size: 15px; color: #9ca3af; margin-bottom: 24px;">An active task assigned to you has an approaching target deadline or has fallen overdue. Please review the details below:</p>
            
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; width: 120px; letter-spacing: 0.5px;">Task Key:</td>
                  <td style="padding: 6px 0; font-weight: 700; color: #6366f1; font-family: monospace; font-size: 16px;">${taskKey || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Summary:</td>
                  <td style="padding: 6px 0; color: #f3f4f6; font-size: 14px; font-weight: 600;">${taskSummary || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Due Date:</td>
                  <td style="padding: 6px 0; color: #ef4444; font-size: 14px; font-weight: 700;">⏰ ${dueDate || "N/A"}</td>
                </tr>
              </table>
            </div>
            <div style="border-left: 3px solid #6366f1; padding-left: 16px; margin: 24px 0; font-style: italic; color: #d1d5db; white-space: pre-line;">${message}</div>
          </div>
          <div style="text-align: center; padding: 0 30px 40px 30px;">
            <a href="${getJiraBaseUrl()}" target="_blank" style="background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);">
              View Issue in Jira Cloud
            </a>
          </div>
          <div style="background-color: rgba(255, 255, 255, 0.01); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #6b7280;">
            This alert was triggered from your ApniLeap JiraPro Dashboard Gateway.<br/>
            To use custom domains, configure SMTP environment variables inside the backend .env file.
          </div>
        </div>
      </div>
    `;

    info = await transporter.sendMail({
      from: hasSmtpConfig 
        ? `"${process.env.SMTP_FROM_NAME || 'JiraPro Platform'}" <${process.env.SMTP_USER}>` 
        : '"JiraPro Alert Gateway" <no-reply@apnileap.com>',
      to: finalTo,
      subject: subject,
      text: message,
      html: htmlTemplate
    });

    let previewUrl = "";
    if (isTestAccount) {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }

    res.json({
      success: true,
      message: isTestAccount 
        ? `Deadline alert reminder simulated! Preview at: ${previewUrl}`
        : `Deadline alert reminder successfully dispatched to ${recipient}!`,
      previewUrl: previewUrl || null,
      dispatchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("SMTP Gateway Error:", error);
    res.status(500).json({
      success: false,
      error: "Relay Gateway Error",
      message: error.message
    });
  }
});

module.exports = router;
