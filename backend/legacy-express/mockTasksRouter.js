const express = require('express');
const router = express.Router();
const db = require('./db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
  "3": { name: "KLE Spoke", key: "AK", boardId: 75 },
  "101": { name: "COEP Spoke", key: "AK", boardId: 76 },
  "102": { name: "MMCOEP Spoke", key: "AK", boardId: 77 },
  "103": { name: "RIT Spoke", key: "AK", boardId: 78 },
};

const CAMPUS_LABELS = {
  "3": "kle-spoke",
  "101": "coep-spoke",
  "102": "mmcoep-spoke",
  "103": "rit-spoke"
};

const CAMPUS_TEAM_MEMBERS = {
  "3": [
    { accountId: "mock-kle-1", displayName: "Rahul Sharma (Student Developer)", emailAddress: "rahul@kle.edu", email: "rahul@kle.edu" },
    { accountId: "mock-kle-2", displayName: "Priya Patel (Student Developer)", emailAddress: "priya@kle.edu", email: "priya@kle.edu" },
    { accountId: "mock-kle-3", displayName: "Prof. Deshpande (Faculty Mentor)", emailAddress: "mentor@kle.edu", email: "mentor@kle.edu" }
  ],
  "101": [
    { accountId: "mock-coep-1", displayName: "Sneha Joshi (Student Developer)", emailAddress: "sneha@coep.edu", email: "sneha@coep.edu" },
    { accountId: "mock-coep-2", displayName: "Amit Waghmare (Student Developer)", emailAddress: "amit@coep.edu", email: "amit@coep.edu" }
  ],
  "102": [
    { accountId: "mock-mmcoep-1", displayName: "Nikhil Rane (Student Developer)", emailAddress: "nikhil@mmcoep.edu", email: "nikhil@mmcoep.edu" },
    { accountId: "mock-mmcoep-2", displayName: "Sayali Deshmukh (Student Developer)", emailAddress: "sayali@mmcoep.edu", email: "sayali@mmcoep.edu" }
  ],
  "103": [
    { accountId: "mock-rit-1", displayName: "Tejas Shinde (Student Developer)", emailAddress: "tejas@rit.edu", email: "tejas@rit.edu" },
    { accountId: "mock-rit-2", displayName: "Priti Patil (Student Developer)", emailAddress: "priti@rit.edu", email: "priti@rit.edu" }
  ]
};

const STUDENT_DEVELOPERS = [
  { accountId: "mock-kle-student", displayName: "KLE Student Developer", emailAddress: "student@kle.edu", email: "student@kle.edu" },
  { accountId: "mock-coep-student", displayName: "COEP Student Developer", emailAddress: "student@coep.edu", email: "student@coep.edu" },
  { accountId: "mock-rit-student", displayName: "RIT Student Developer", emailAddress: "student@rit.edu", email: "student@rit.edu" }
];

const MOCK_ASSIGNEES = [
  { accountId: "mock-1", displayName: "Manasa Vasare (Coordinator)", emailAddress: "coordinator@kle.edu", email: "coordinator@kle.edu" },
  ...STUDENT_DEVELOPERS,
  ...CAMPUS_TEAM_MEMBERS["3"],
  ...CAMPUS_TEAM_MEMBERS["101"],
  ...CAMPUS_TEAM_MEMBERS["102"],
  ...CAMPUS_TEAM_MEMBERS["103"],
];

// GET /tasks: Retrieve tasks for a board from local Postgres store
router.get("/tasks", async (req, res) => {
  const boardId = req.query.boardId || "3";
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

// GET /myself: Retrieve local profile info
router.get("/myself", async (req, res) => {
  const mockProfile = {
    accountId: "admin-mock-id",
    displayName: "apnileapos (Offline)",
    emailAddress: "apnileapos@gmail.com",
    avatarUrls: {
      "48x48": "https://i.pravatar.cc/150?img=68"
    },
    active: true,
    timeZone: "Asia/Kolkata"
  };
  res.json(mockProfile);
});

// POST /tasks: Create a new mock task
router.post("/tasks", verifyToken, async (req, res) => {
  const { summary, description, statusName, priorityName, assigneeId, reporterId, dueDate, issueTypeName, boardId, parentId, parentKey, parentSummary } = req.body;
  const targetBoardId = boardId || "3";
  const spoke = SPOKES[targetBoardId];

  let assignedUserObj = MOCK_ASSIGNEES.find(a => a.accountId === assigneeId) || null;
  let reporterUserObj = reporterId ? MOCK_ASSIGNEES.find(a => a.accountId === reporterId) || MOCK_ASSIGNEES[0] : MOCK_ASSIGNEES[0];

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

// PUT /tasks/:key: Update fields of a mock task in PostgreSQL
router.put("/tasks/:key", verifyToken, async (req, res) => {
  const { key } = req.params;
  const { summary, description, dueDate, assignee, reporter, priority } = req.body;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  let assignedUserObj = assignee ? MOCK_ASSIGNEES.find(a => a.accountId === assignee) || null : null;
  let reporterUserObj = reporter ? MOCK_ASSIGNEES.find(a => a.accountId === reporter) || null : null;

  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const taskId = result.rows[0].id;
    const taskFields = typeof result.rows[0].fields === 'string' ? JSON.parse(result.rows[0].fields) : result.rows[0].fields;

    if (summary !== undefined) taskFields.summary = summary;
    if (description !== undefined) taskFields.description = description;
    if (dueDate !== undefined) taskFields.duedate = dueDate === "" ? null : dueDate;
    if (priority !== undefined) taskFields.priority = { name: priority };
    if (assignee !== undefined) taskFields.assignee = assignedUserObj;
    if (reporter !== undefined) taskFields.reporter = reporterUserObj;

    await db.query(
      `UPDATE mock_tasks SET fields = $1, updated_at = NOW() WHERE key = $2`,
      [JSON.stringify(taskFields), key]
    );

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

// PUT /tasks/:key/flag: Toggle standard impediment status
router.put("/tasks/:key/flag", async (req, res) => {
  const { key } = req.params;
  const { flagged } = req.body;
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

// POST /tasks/:key/subtask: Create child subtask inside PostgreSQL
router.post("/tasks/:key/subtask", verifyToken, async (req, res) => {
  const { key } = req.params;
  const { summary, assigneeId, parentIssueType } = req.body;
  const projectKey = key.split("-")[0];
  const spoke = Object.values(SPOKES).find(s => s.key === projectKey);

  if (!spoke) {
    return res.status(400).json({ error: "Invalid task key context. Spoke project not found." });
  }

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

    await db.query(
      `INSERT INTO mock_tasks (id, key, board_id, fields) 
       VALUES ($1, $2, $3, $4)`,
      [newId, newKey, parentTask.board_id, JSON.stringify(newChildFields)]
    );

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

// POST /tasks/links: Link issues
router.post("/tasks/links", async (req, res) => {
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
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -1px; color: white;">ApniLeap Agile Workspace</h1>
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
            <a href="${process.env.GITLAB_BASE_URL || 'http://localhost:8080'}" target="_blank" style="background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);">
              View Issue in GitLab Boards
            </a>
          </div>
          <div style="background-color: rgba(255, 255, 255, 0.01); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #6b7280;">
            This alert was triggered from your ApniLeap Agile Dashboard Gateway.<br/>
            To use custom domains, configure SMTP environment variables inside the backend .env file.
          </div>
        </div>
      </div>
    `;

    info = await transporter.sendMail({
      from: hasSmtpConfig 
        ? `"${process.env.SMTP_FROM_NAME || 'Agile Workspace Platform'}" <${process.env.SMTP_USER}>` 
        : '"Agile Workspace Alert Gateway" <no-reply@apnileap.com>',
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
