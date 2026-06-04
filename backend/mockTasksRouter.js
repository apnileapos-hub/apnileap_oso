const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
require('dotenv').config();

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

// GET /tasks: Retrieve tasks for a board (either JIRA or mock Postgres storage)
router.get("/tasks", async (req, res) => {
  const boardId = req.query.boardId || "3";
  const spoke = SPOKES[boardId];

  const JIRA_BASE = process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";
  const JIRA_PROJECT = process.env.JIRA_PROJECT_KEY || "SCRUM";
  const jiraAuth = {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN,
  };
  const jiraHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const authBase64 = Buffer.from(`${jiraAuth.username}:${jiraAuth.password}`).toString('base64');

  if (spoke && spoke.live && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
    try {
      const response = await axios.get(
        `${JIRA_BASE}/rest/agile/1.0/board/${spoke.boardId}/issue`,
        {
          headers: {
            Authorization: `Basic ${authBase64}`,
            ...jiraHeaders
          },
          timeout: 5000
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

      // Convert fields format to standard shape
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
          flagged: issue.fields?.customfield_10021 ? true : false,
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

  // Fallback or default to Postgres mock_tasks table
  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE board_id = $1 ORDER BY created_at DESC', [boardId]);
    const mockTasks = result.rows.map(row => ({
      id: row.id,
      key: row.key,
      boardId: row.board_id,
      fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields
    }));
    res.json(mockTasks);
  } catch (error) {
    console.error("Failed to fetch mock tasks:", error);
    res.status(500).json({ error: "Failed to fetch mock tasks" });
  }
});

// POST /tasks: Create a new task (Postgres fallback)
router.post("/tasks", async (req, res) => {
  const { summary, description, boardId, priority, issueType, parentKey } = req.body;
  const targetBoardId = boardId || "3";
  const spoke = SPOKES[targetBoardId];
  const taskId = `mock-${targetBoardId}-${Date.now()}`;
  const key = spoke ? `${spoke.key}-${Math.floor(Math.random() * 1000) + 100}` : `MOCK-${Date.now()}`;

  const fields = {
    summary: summary || "Unnamed Task",
    description: description || "",
    status: { name: "Backlog" },
    priority: { name: priority || "Medium" },
    issuetype: { name: issueType || "Task" },
    created: new Date().toISOString(),
    flagged: false,
    parent: parentKey ? { key: parentKey } : null
  };

  try {
    const result = await db.query(
      `INSERT INTO mock_tasks (id, key, board_id, fields) 
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [taskId, key, targetBoardId, JSON.stringify(fields)]
    );
    res.json({ success: true, task: { id: taskId, key, boardId: targetBoardId, fields } });
  } catch (error) {
    console.error("Failed to create mock task:", error);
    res.status(500).json({ error: "Failed to create mock task" });
  }
});

// PUT /tasks/:key: Update fields of a mock task in Postgres
router.put("/tasks/:key", async (req, res) => {
  const { key } = req.params;
  const { summary, description, status, priority } = req.body;

  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = result.rows[0];
    const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;

    if (summary) fields.summary = summary;
    if (description) fields.description = description;
    if (status) fields.status = { name: status };
    if (priority) fields.priority = { name: priority };

    await db.query(
      'UPDATE mock_tasks SET fields = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
      [JSON.stringify(fields), key]
    );

    res.json({ success: true, task: { id: task.id, key, boardId: task.board_id, fields } });
  } catch (error) {
    console.error("Failed to update task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// POST /tasks/:key/transition: Transition task status
router.post("/tasks/:key/transition", async (req, res) => {
  const { key } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    const result = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = result.rows[0];
    const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;
    fields.status = { name: status };

    await db.query(
      'UPDATE mock_tasks SET fields = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
      [JSON.stringify(fields), key]
    );

    res.json({ success: true, message: `Successfully transitioned to ${status}` });
  } catch (error) {
    console.error("Failed to transition task:", error);
    res.status(500).json({ error: "Failed to transition task" });
  }
});

// DELETE /tasks/:key: Delete a mock task
router.delete("/tasks/:key", async (req, res) => {
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

module.exports = router;
