const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");

// Always load .env from the backend folder, regardless of where Node is started
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Jira config (env-driven with safe defaults) ───────────────────────────────
const JIRA_BASE    = process.env.JIRA_BASE_URL    || "https://devcobraaa.atlassian.net";
const JIRA_PROJECT = process.env.JIRA_PROJECT_KEY || "SCRUM";

const jiraAuth = {
  username: process.env.JIRA_EMAIL,
  password: process.env.JIRA_API_TOKEN,
};

const jiraHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

// ── Helper: fetch all issues with rich fields ─────────────────────────────────
async function fetchAllIssues() {
  const response = await axios.post(
    `${JIRA_BASE}/rest/api/3/search/jql`,
    {
      jql: `project = ${JIRA_PROJECT} ORDER BY created DESC`,
      maxResults: 100,
      fields: [
        "summary", "status", "assignee", "priority",
        "issuetype", "created", "updated", "resolution",
      ],
    },
    { auth: jiraAuth, headers: jiraHeaders }
  );
  return response.data.issues || [];
}

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── GET /issues ───────────────────────────────────────────────────────────────
app.get("/issues", async (req, res) => {
  try {
    const issues = await fetchAllIssues();
    res.json(issues);
  } catch (error) {
    console.error("Error /issues:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ── GET /status-summary ───────────────────────────────────────────────────────
app.get("/status-summary", async (req, res) => {
  try {
    const issues = await fetchAllIssues();
    const tally = {};
    issues.forEach((issue) => {
      const status = issue.fields?.status?.name || "Unknown";
      tally[status] = (tally[status] || 0) + 1;
    });
    res.json(
      Object.entries(tally).map(([status, count]) => ({ status, count }))
    );
  } catch (error) {
    console.error("Error /status-summary:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ── GET /assignee-summary ─────────────────────────────────────────────────────
app.get("/assignee-summary", async (req, res) => {
  try {
    const issues = await fetchAllIssues();
    const tally = {};
    issues.forEach((issue) => {
      const assignee = issue.fields?.assignee?.displayName || "Unassigned";
      tally[assignee] = (tally[assignee] || 0) + 1;
    });
    const result = Object.entries(tally)
      .map(([assignee, count]) => ({ assignee, count }))
      .sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (error) {
    console.error("Error /assignee-summary:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ── GET /dashboard-metrics ────────────────────────────────────────────────────
app.get("/dashboard-metrics", async (req, res) => {
  try {
    const issues = await fetchAllIssues();
    const total = issues.length;
    let open = 0, inProgress = 0, done = 0, totalAgeDays = 0;
    const now = Date.now();

    issues.forEach((issue) => {
      const s = (issue.fields?.status?.name || "").toLowerCase();
      if (s.includes("done") || s.includes("closed") || s.includes("resolved")) done++;
      else if (s.includes("progress") || s.includes("review") || s.includes("testing")) inProgress++;
      else open++;

      if (issue.fields?.created) {
        totalAgeDays +=
          (now - new Date(issue.fields.created).getTime()) / (1000 * 60 * 60 * 24);
      }
    });

    const avgAgeDays = total > 0 ? Math.round(totalAgeDays / total) : 0;
    res.json({ total, open, inProgress, done, avgAgeDays });
  } catch (error) {
    console.error("Error /dashboard-metrics:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ── Serve React build (production / single-server mode) ───────────────────────
// When 'npm run build' is run from the root, the React app is built into
// frontend/frontend/build and Express serves it alongside the API.
const buildPath = path.join(__dirname, "..", "frontend", "frontend", "build");

if (fs.existsSync(buildPath)) {
  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(buildPath));

  // Catch-all route — must come AFTER all API routes
  // Express 5 requires named wildcard params; "/{*path}" matches everything
  app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });

  console.log(`📦  Serving React build → ${buildPath}`);
  console.log(`🌐  Visit http://localhost:${process.env.PORT || 5000}`);
} else {
  console.log(`💡  React build not found. Run 'npm run build' from the project root.`);
  console.log(`    Dev mode: start React separately on port 3000.`);
}

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n✅  Jira Dashboard API  →  http://localhost:${PORT}`);
  console.log(`   API routes: /health  /issues  /status-summary  /assignee-summary  /dashboard-metrics\n`);
});

// ── Error handler — catches port-in-use and other listen errors ───────────────
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌  Port ${PORT} is already in use!`);
    console.error(`    Stop the other process first, or use a different port:`);
    console.error(`    SET PORT=5001 && node server.js\n`);
  } else {
    console.error(`\n❌  Server error: ${err.message}\n`);
  }
  process.exit(1);
});

// ── Graceful shutdown on Ctrl+C / SIGTERM ─────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n⏹  ${signal} — shutting down…`);
  server.close(() => {
    console.log("✅  Server closed.\n");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));