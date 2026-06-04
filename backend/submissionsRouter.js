const express = require('express');
const router = express.Router();
const db = require('./db');

// POST: Create a student deliverable submission against a task
router.post("/tasks/:taskId/submit", async (req, res) => {
  const { taskId } = req.params;
  const { studentName, fileName, fileUrl, comments } = req.body;

  if (!studentName || !fileName || !fileUrl) {
    return res.status(400).json({ error: "Missing required fields (studentName, fileName, fileUrl)" });
  }

  try {
    const result = await db.query(
      `INSERT INTO submissions (task_id, student_name, file_name, file_url, comments)
       VALUES ($1, $2, $3, $4, $5)
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

module.exports = router;
