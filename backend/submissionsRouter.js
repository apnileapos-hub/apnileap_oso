const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const jwt = require('jsonwebtoken');

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

// Ensure columns status and feedback exist on submissions table
async function runMigration() {
  try {
    await db.query(`
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending Review';
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT '';
    `);
    console.log("Submissions schema checked/migrated successfully.");
  } catch (err) {
    console.error("Submissions migration error:", err.message);
  }
}
runMigration();

const getJiraBaseUrl = () => {
  return process.env.JIRA_DOMAIN || process.env.JIRA_BASE_URL || "https://apnileapos.atlassian.net";
};

const getJiraAuthHeader = () => {
  const email = process.env.JIRA_EMAIL || "";
  const token = process.env.JIRA_API_TOKEN || "";
  return Buffer.from(`${email}:${token}`).toString("base64");
};

const shouldCheckJira = () => {
  return !!(process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
};

// POST: Create a student deliverable submission against a task
router.post("/tasks/:taskId/submit", verifyToken, async (req, res) => {
  const { taskId } = req.params;
  const { studentName, fileName, fileUrl, comments } = req.body;

  if (!studentName || !fileName || !fileUrl) {
    return res.status(400).json({ error: "Missing required fields (studentName, fileName, fileUrl)" });
  }

  try {
    const result = await db.query(
      `INSERT INTO submissions (task_id, student_name, file_name, file_url, comments, status, feedback)
       VALUES ($1, $2, $3, $4, $5, 'Pending Review', '')
       RETURNING *`,
      [taskId, studentName, fileName, fileUrl, comments || ""]
    );
    res.json({ success: true, submission: result.rows[0] });
  } catch (error) {
    console.error("Failed to submit deliverable:", error);
    res.status(500).json({ error: "Failed to submit deliverable" });
  }
});

// GET: Fetch all submissions for a specific task
router.get("/tasks/:taskId/submissions", async (req, res) => {
  const { taskId } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM submissions WHERE task_id = $1 ORDER BY submitted_at DESC`,
      [taskId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch task submissions:", error);
    res.status(500).json({ error: "Failed to fetch task submissions" });
  }
});

// GET: Fetch all submissions system-wide
router.get("/submissions", async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM submissions ORDER BY submitted_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch submissions:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// PUT /submissions/:id/status: Update approval status & reactive task transition
router.put("/submissions/:id/status", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status, feedback } = req.body;

  if (!status || !["Approved", "Re-work Requested"].includes(status)) {
    return res.status(400).json({ error: "Valid status ('Approved' or 'Re-work Requested') is required." });
  }

  try {
    const subCheck = await db.query('SELECT * FROM submissions WHERE id = $1', [id]);
    if (subCheck.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found." });
    }
    const submission = subCheck.rows[0];

    // Update submission in PostgreSQL
    const updatedRes = await db.query(
      `UPDATE submissions SET status = $1, feedback = $2 WHERE id = $3 RETURNING *`,
      [status, feedback || "", id]
    );
    const updatedSub = updatedRes.rows[0];

    console.log(`[SUBMISSION AUDIT] Updated submission ${id} for task ${submission.task_id} to status: ${status}`);

    // High-Value Reactive Integration: Transition task statuses automatically!
    try {
      const taskId = submission.task_id;
      const targetStatusName = status === "Approved" ? "Done" : "In Progress";

      // 1. Check if mock task exists in PostgreSQL
      const mockCheck = await db.query('SELECT * FROM mock_tasks WHERE id = $1 OR key = $2', [taskId, taskId]);
      if (mockCheck.rows.length > 0) {
        const mockTask = mockCheck.rows[0];
        const fields = typeof mockTask.fields === 'string' ? JSON.parse(mockTask.fields) : mockTask.fields;
        
        fields.status = { name: targetStatusName };
        if (status === "Re-work Requested") {
          fields.flagged = true;
          fields.description = `${fields.description || ""}\n\n⚠️ [MENTOR FEEDBACK]: ${feedback}`;
        } else {
          fields.flagged = false;
        }

        await db.query(
          'UPDATE mock_tasks SET fields = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(fields), mockTask.id]
        );
        console.log(`[REACTIVE AGENT] Automatically transitioned Mock Task ${taskId} to '${targetStatusName}'!`);
      } else if (shouldCheckJira()) {
        // 2. Handle live JIRA issue transition
        console.log(`[REACTIVE AGENT] Resolving live JIRA task ${taskId} for automated status transition...`);
        const JIRA_BASE = getJiraBaseUrl();
        const authBase64 = getJiraAuthHeader();

        const transRes = await axios.get(
          `${JIRA_BASE}/rest/api/3/issue/${taskId}/transitions`,
          {
            headers: {
              Authorization: `Basic ${authBase64}`,
              Accept: "application/json",
            },
            timeout: 10000
          }
        );
        const transitions = transRes.data.transitions || [];

        const match = transitions.find(t => 
          t.name.toLowerCase() === targetStatusName.toLowerCase() ||
          t.to.name.toLowerCase() === targetStatusName.toLowerCase()
        );

        if (match) {
          await axios.post(
            `${JIRA_BASE}/rest/api/3/issue/${taskId}/transitions`,
            { transition: { id: match.id } },
            {
              headers: {
                Authorization: `Basic ${authBase64}`,
                Accept: "application/json",
                "Content-Type": "application/json"
              },
              timeout: 10000
            }
          );
          console.log(`[REACTIVE AGENT] Successfully transitioned live JIRA issue ${taskId} to '${targetStatusName}'!`);

          if (status === "Re-work Requested") {
            try {
              await axios.post(
                `${JIRA_BASE}/rest/api/2/issue/${taskId}/comment`,
                { body: `⚠️ [RE-WORK REQUESTED BY COORDINATOR]:\n${feedback}` },
                {
                  headers: {
                    Authorization: `Basic ${authBase64}`,
                    Accept: "application/json",
                    "Content-Type": "application/json"
                  },
                  timeout: 10000
                }
              );
              console.log(`[REACTIVE AGENT] Successfully appended re-work feedback comment to JIRA task ${taskId}.`);
            } catch (commentErr) {
              console.warn("Failed to add comment to JIRA:", commentErr.response?.data || commentErr.message);
            }
          }
        } else {
          console.warn(`[REACTIVE AGENT] No transition workflow path found to '${targetStatusName}' for live issue ${taskId}.`);
        }
      }
    } catch (taskErr) {
      console.warn("[REACTIVE AGENT] Failed to run automated task transitions on submission update:", taskErr.message);
    }

    res.json({ success: true, submission: updatedSub });
  } catch (error) {
    console.error("Failed to update submission status:", error);
    res.status(500).json({ error: "Failed to update submission status" });
  }
});

// DELETE /submissions/:id: Delete a student submission persistently
router.delete("/submissions/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM submissions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found." });
    }
    console.log(`[SUBMISSION AUDIT] Deleted submission ${id} for task ${result.rows[0].task_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete student submission:", error);
    res.status(500).json({ error: "Failed to delete student submission" });
  }
});

module.exports = router;
