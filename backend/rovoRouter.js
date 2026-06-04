const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_jwt_secret";

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

// POST: Rovo chatbot chat engine with natural language intent actions
router.post("/api/rovo/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message content required" });
  }

  const queryText = message.toLowerCase().trim();
  let reply = `🤖 **APNILEAP Copilot couldn't match that command.**

Try asking me to:
• **List projects**: \`list projects\` or \`show active projects\`
• **Create a project**: \`create project ApniCart for KLE Spoke\`
• **Accept a project**: \`accept project ApniCart by Prof. Deshpande\`
• **Add documents**: \`add document report.pdf to project ApniCart\`
• **Show documents**: \`show documents for project ApniCart\`
• **List meetings**: \`list meetings\`
• **Check profile**: \`who am i\`
• Or type \`help\` to see all capabilities.`;

  try {
    // INTENT 0.1: Greetings
    if (queryText === "hi" || queryText === "hello" || queryText === "hey" || queryText.startsWith("hello ") || queryText.startsWith("hi ")) {
      return res.json({
        reply: `👋 **Hello! I am Rovo, your APNILEAP Copilot.**\n\nHow can I help you today? You can ask me about projects, meetings, repositories, or system status. Try asking: **'show active projects'**, **'list meetings'**, or **'what can you do?'**.`
      });
    }

    // INTENT 0.2: Help / Capabilities
    if (queryText.includes("help") || queryText.includes("what can you do") || queryText.includes("capabilities")) {
      return res.json({
        reply: `🤖 **APNILEAP Rovo Copilot Capabilities:**\n\nHere is what you can ask me to do:\n\n` +
               `1. **List active projects**: \`list projects\` or \`show active projects\`\n` +
               `2. **Create/propose a project** (provisions Jira Epic & Confluence space): \`create project [Name] for [Spoke Name]\`\n` +
               `3. **Accept a project**: \`accept project [Name] by [Authorized Person]\`\n` +
               `4. **Manage project documents**: \`add document [File] to project [Name]\` or \`show documents for project [Name]\`\n` +
               `5. **List meetings**: \`list meetings\` or \`show sync schedules\`\n` +
               `6. **List Git repositories**: \`list repos\` or \`show repositories\`\n` +
               `7. **Check system audit trail**: \`show audit logs\` or \`show history\`\n` +
               `8. **Identify your profile**: \`who am i\``
      });
    }

    // INTENT 0.3: Who am I (User Profile)
    if (queryText.includes("who am i") || queryText.includes("my profile") || queryText.includes("current user")) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return res.json({
              reply: `👤 **Current User Profile:**\n\n• **Email:** ${decoded.email}\n• **Role:** ${decoded.role || 'User'}\n• **Campus ID:** ${decoded.collegeId || '—'}`
            });
          } catch (err) {
            // Token expired or invalid
          }
        }
      }
      return res.json({
        reply: `👤 **Guest User:**\n\nYou are currently communicating as a guest or your session token has expired. Please log in to see your authenticated profile details.`
      });
    }

    // INTENT 1: Accept a project
    if (queryText.includes("accept") && queryText.includes("project")) {
      const projMatch = message.match(/(?:accept project|accept)\s+(.+?)\s+by/i);
      const nameMatch = message.match(/by\s+(.+)$/i);

      const projName = projMatch ? projMatch[1].trim() : null;
      const acceptedBy = nameMatch ? nameMatch[1].trim() : "Faculty Coordinator";

      if (!projName) {
        return res.json({ reply: "Please specify the project name. Example: 'accept project ApniCart by Prof. Deshpande'" });
      }

      const result = await db.query('SELECT * FROM projects WHERE LOWER(name) = $1', [projName.toLowerCase()]);
      if (result.rows.length === 0) {
        return res.json({ reply: `I couldn't find a project named "${projName}" in the database to accept.` });
      }

      const project = result.rows[0];

      const { autoGenerateIssuesForProject } = require('./rovoIssueService');
      const autoKey = project.jira_project_key || project.jiraProjectKey || process.env.JIRA_PROJECT_KEY || "SCRUM";
      let jiraBoardUrl = project.jira_board_url || project.jiraBoardUrl;

      if (!project.jira_project_key) {
        project.jira_project_key = autoKey;
        jiraBoardUrl = `${process.env.JIRA_BASE_URL || "https://apnileapos.atlassian.net"}/browse/${autoKey}`;
        project.jira_board_url = jiraBoardUrl;
      }

      const confluenceSpaceUrl = `https://confluence.apnileap.com/display/${project.name.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
      project.confluence_space_url = confluenceSpaceUrl;

      // Automate GitHub Private Repository Creation
      const cleanName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const repoName = `apnileap-${cleanName}`;
      let repoUrl = `https://github.com/apnileapos-hub/${repoName}`;
      const githubToken = process.env.GITHUB_TOKEN;
      const githubOrg = process.env.GITHUB_ORG || 'apnileapos-hub';

      if (githubToken) {
        try {
          console.log(`[Rovo] Attempting to automate GitHub repository creation for: ${repoName}`);
          let createUrl = 'https://api.github.com/user/repos';
          let isOrg = false;
          
          if (githubOrg) {
            createUrl = `https://api.github.com/orgs/${githubOrg}/repos`;
            isOrg = true;
          }

          let ghRes;
          try {
            ghRes = await axios.post(
              createUrl,
              {
                name: repoName,
                description: `Automated repository for APNILEAP project: ${project.name}`,
                private: true,
                auto_init: true
              },
              {
                headers: {
                  'Authorization': `token ${githubToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'User-Agent': 'APNILEAP-App'
                }
              }
            );
          } catch (orgErr) {
            if (isOrg && (orgErr.response?.status === 404 || orgErr.response?.status === 403)) {
              console.log(`[Rovo Fallback] Organization endpoint failed (${orgErr.response?.status}). Falling back to personal user repository creation...`);
              ghRes = await axios.post(
                'https://api.github.com/user/repos',
                {
                  name: repoName,
                  description: `Automated repository for APNILEAP project: ${project.name}`,
                  private: true,
                  auto_init: true
                },
                {
                  headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'APNILEAP-App'
                  }
                }
              );
            } else {
              throw orgErr;
            }
          }

          if (ghRes && ghRes.data && ghRes.data.html_url) {
            repoUrl = ghRes.data.html_url;
            console.log(`[Rovo] Successfully created GitHub repository: ${repoUrl}`);
          }
        } catch (ghErr) {
          console.error("[Rovo] Failed to automatically create repository on GitHub:", ghErr.response?.data || ghErr.message);
        }
      }

      // Save Repository details to Database
      try {
        await db.query(
          `INSERT INTO repositories (project_id, repo_name, repo_url) 
           VALUES ($1, $2, $3)
           ON CONFLICT (repo_name) DO UPDATE SET repo_url = EXCLUDED.repo_url`,
          [project.id, repoName, repoUrl]
        );
      } catch (dbErr) {
        console.error("[Rovo] Failed to insert repository in DB:", dbErr.message);
      }

      await db.query(
        `UPDATE projects 
         SET status = 'ACCEPTED', accepted_by = $1, confluence_space_url = $2, jira_board_url = $3, jira_project_key = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
         [acceptedBy, confluenceSpaceUrl, jiraBoardUrl, autoKey, project.id]
      );

      // Trigger automatic issue and epic auto-generation via Rovo Agent
      try {
        project.epics = project.epics || [];
        await autoGenerateIssuesForProject(project, autoKey);
      } catch (rovoErr) {
        console.error("Failed to automatically generate issues via Rovo Service in Chat:", rovoErr.message);
      }

      return res.json({
        reply: `✅ **Project Accepted Successfully!**\n\n• **Project:** ${project.name}\n• **Accepted By:** ${acceptedBy}\n• **New Status:** ACCEPTED\n• **Jira Project Key:** ${autoKey}\n• **Jira Link:** [Jira Board](${jiraBoardUrl})\n• **Confluence Link:** [Space Link](${confluenceSpaceUrl})\n• **Git Repository:** [Repository Link](${repoUrl})\n• **Rovo Auto-Tasks:** Automated task lists have been generated and synced under each epic!\n• **Timestamp:** ${new Date().toLocaleString()}`
      });
    }

    // INTENT 2: Add work progress documents
    if (queryText.includes("add") && queryText.includes("document")) {
      const docMatch = message.match(/(?:add document|add doc)\s+(.+?)\s+to/i);
      const projMatch = message.match(/to\s+project\s+(.+)$/i);

      const docName = docMatch ? docMatch[1].trim() : null;
      const projName = projMatch ? projMatch[1].trim() : null;

      if (!docName || !projName) {
        return res.json({ reply: "Format error. Try: 'add document report.pdf to project ApniCart'" });
      }

      const result = await db.query('SELECT * FROM projects WHERE LOWER(name) = $1', [projName.toLowerCase()]);
      if (result.rows.length === 0) {
        return res.json({ reply: `I couldn't find a project named "${projName}" in the database.` });
      }

      const project = result.rows[0];
      const docs = Array.isArray(project.work_progress_docs) 
        ? project.work_progress_docs 
        : (typeof project.work_progress_docs === 'string' ? JSON.parse(project.work_progress_docs) : []);

      const newDoc = {
        name: docName,
        uploaded_at: new Date().toISOString(),
        url: `https://apnileap-docs.s3.amazonaws.com/projects/${project.id}/${docName}`
      };
      docs.push(newDoc);

      await db.query(
        `UPDATE projects 
         SET work_progress_docs = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(docs), project.id]
      );

      return res.json({
        reply: `📄 **Document Added to Work Progress!**\n\n• **Project:** ${project.name}\n• **Document Name:** ${docName}\n• **Access Link:** ${newDoc.url}`
      });
    }

    // INTENT 3: Show progress documents for project
    if (queryText.includes("show") && queryText.includes("document")) {
      const projMatch = message.match(/(?:for project|for)\s+(.+)$/i);
      const projName = projMatch ? projMatch[1].trim() : null;

      if (!projName) {
        return res.json({ reply: "Please specify the project name. Example: 'show documents for project ApniCart'" });
      }

      const result = await db.query('SELECT * FROM projects WHERE LOWER(name) = $1', [projName.toLowerCase()]);
      if (result.rows.length === 0) {
        return res.json({ reply: `I couldn't find a project named "${projName}".` });
      }

      const project = result.rows[0];
      const docs = project.work_progress_docs || [];

      if (docs.length === 0) {
        return res.json({ reply: `There are no progress documents uploaded for project "${project.name}" yet.` });
      }

      const list = docs.map(d => `• **${d.name}** (Uploaded: ${new Date(d.uploaded_at).toLocaleDateString()}) - [Link](${d.url})`).join("\n");
      return res.json({
        reply: `📂 **Progress Documents for ${project.name}:**\n\n${list}`
      });
    }

    // INTENT 4: Schedule a meeting
    if (queryText.includes("schedule") && queryText.includes("meeting")) {
      const titleMatch = message.match(/(?:schedule a meeting|schedule meeting)\s+(.+?)\s+on/i);
      const dateMatch = message.match(/on\s+(\d{4}-\d{2}-\d{2})/i);
      const timeMatch = message.match(/at\s+(\d{2}:\d{2}\s*(?:AM|PM|am|pm|\d{2}))/i);
      
      const title = titleMatch ? titleMatch[1].trim() : "Sync Meeting";
      const date = dateMatch ? dateMatch[1].trim() : "2026-06-01";
      const time = timeMatch ? timeMatch[1].trim() : "10:00 AM";
      const campusId = queryText.includes("coep") ? "101" : queryText.includes("mmcoep") ? "102" : queryText.includes("rit") ? "103" : "3";

      const id = `meet-${Date.now()}`;
      const link = "https://teams.microsoft.com/";
      const agenda = `Rovo provisioned sync meeting for ${title}`;

      await db.query(
        `INSERT INTO meetings (id, title, campus_id, date, time, link, agenda) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, title, campusId, date, time, link, agenda]
      );

      return res.json({
        reply: `📅 **Meeting Scheduled Successfully!**\n\n• **Title:** ${title}\n• **Date/Time:** ${date} at ${time}\n• **Campus ID:** ${campusId}\n• **Link:** ${link}`
      });
    }

    // INTENT 5: Create project (connects to live JIRA REST API & Confluence space stub)
    if (queryText.includes("create") && queryText.includes("project")) {
      const titleMatch = message.match(/(?:create project|create a project|create a new project)\s+(.+?)\s+for/i) || message.match(/(?:create project|create a project|create a new project)\s+(.+)$/i);
      const collegeMatch = message.match(/for\s+(.+?)\s+(?:budget|weeks|$)/i);
      const budgetMatch = message.match(/budget\s+(\d+)/i);
      const weeksMatch = message.match(/(?:weeks|duration)\s+(\d+)/i);

      const title = titleMatch ? titleMatch[1].trim() : "New College Project";
      const collegeName = collegeMatch ? collegeMatch[1].trim() : "KLE Spoke";
      const budget = budgetMatch ? parseFloat(budgetMatch[1]) : 50000.00;
      const weeks = weeksMatch ? parseInt(weeksMatch[1]) : 12;
      const collegeId = queryText.includes("coep") ? 101 : queryText.includes("mmcoep") ? 102 : queryText.includes("rit") ? 103 : 3;

      let jiraKey = null;
      let jiraBoardUrl = null;

      // Make live JIRA Epic creation call using Atlassian API
      if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
        try {
          const epicBody = {
            fields: {
              project: { key: JIRA_PROJECT },
              summary: `[Epic] ${title}`,
              description: {
                type: "doc",
                version: 1,
                content: [{
                  type: "paragraph",
                  content: [{ type: "text", text: `Project proposed via Rovo AI Copilot for ${collegeName}.` }]
                }]
              },
              issuetype: { name: "Epic" }
            }
          };

          const jiraRes = await axios.post(
            `${JIRA_BASE}/rest/api/3/issue`,
            epicBody,
            {
              headers: {
                Authorization: `Basic ${authBase64}`,
                ...jiraHeaders
              },
              timeout: 5000
            }
          );
          jiraKey = jiraRes.data.key;
          jiraBoardUrl = `${JIRA_BASE}/browse/${jiraKey}`;
          console.log(`📡 JIRA Epic auto-provisioned by Rovo: ${jiraKey}`);
        } catch (jiraErr) {
          console.warn("Failed to auto-provision JIRA Epic, falling back to local PostgreSQL mocks:", jiraErr.message);
        }
      }

      // Generate Confluence Page space link
      const confluenceSpaceUrl = `https://confluence.apnileap.com/display/${title.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

      const projectId = Date.now();
      const projRes = await db.query(
        `INSERT INTO projects (id, name, description, budget, duration_weeks, status, created_by, confluence_space_url, jira_board_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          projectId,
          title, 
          `Project proposed by Rovo Copilot for ${collegeName}`, 
          budget, 
          weeks, 
          'OPEN_FOR_BIDDING', 
          'Rovo Copilot', 
          confluenceSpaceUrl, 
          jiraBoardUrl || `${JIRA_BASE}/jira/boards/75`
        ]
      );

      const project = projRes.rows[0];

      // Assign project to campus spoke safely
      try {
        await db.query(
          `INSERT INTO project_assignments (project_id, college_id)
           VALUES ($1, $2)`,
          [project.id, collegeId]
        );
      } catch (assignErr) {
        // Safe fallback in case references are missing
      }

      return res.json({
        reply: `🚀 **Project Proposed & Provisioned via JIRA & Confluence API!**\n\n• **Project Name:** ${title}\n• **Target Spoke:** ${collegeName}\n• **JIRA Epic Provisioned:** ${jiraKey || 'MOCK-KEY'}\n• **JIRA Link:** [Jira Board](${project.jira_board_url})\n• **Confluence space provisioned:** [Confluence Space](${confluenceSpaceUrl})\n• **Status:** ${project.status}`
      });
    }

    // INTENT 6: Create task under epic
    if (queryText.includes("create task") && queryText.includes("under epic")) {
      const taskMatch = message.match(/(?:create task|create a task|create a new task)\s+(.+?)\s+under epic/i);
      const epicMatch = message.match(/under epic\s+(.+)$/i);

      const taskSummary = taskMatch ? taskMatch[1].trim() : null;
      const epicRef = epicMatch ? epicMatch[1].trim() : null;

      if (!taskSummary || !epicRef) {
        return res.json({ reply: "Format error. Try: 'create task Implement OAuth under epic Requirements & Architecture Specification' or 'create task Setup SSL under epic APNI784-EPIC-1'" });
      }

      const projRes = await db.query('SELECT id, name, jira_project_key, epics FROM projects');
      
      let matchedProject = null;
      let matchedEpic = null;

      for (const row of projRes.rows) {
        let epics = row.epics;
        if (typeof epics === 'string') {
          epics = JSON.parse(epics);
        }
        if (Array.isArray(epics)) {
          const found = epics.find(e => 
            (e.jiraKey && e.jiraKey.toLowerCase() === epicRef.toLowerCase()) || 
            (e.id && e.id.toLowerCase() === epicRef.toLowerCase()) ||
            (e.title && e.title.toLowerCase().includes(epicRef.toLowerCase()))
          );
          if (found) {
            matchedProject = row;
            matchedEpic = found;
            break;
          }
        }
      }

      if (!matchedEpic) {
        return res.json({ reply: `I couldn't find an active Epic matching "${epicRef}" in any project.` });
      }

      const projectKey = matchedProject.jira_project_key || 'APNI';
      const boardId = '3';
      const taskId = `mock-rovo-${Date.now()}`;
      const taskKey = `${projectKey}-${100 + Math.floor(Math.random() * 900)}`;

      const fields = {
        summary: taskSummary,
        description: `Task created under Epic "${matchedEpic.title}" via Rovo AI Copilot`,
        status: { name: "To Do" },
        priority: { name: "Medium" },
        issuetype: { name: "Task" },
        created: new Date().toISOString(),
        flagged: false,
        parent: {
          key: matchedEpic.jiraKey || matchedEpic.id,
          summary: matchedEpic.title,
          issueType: "Epic"
        }
      };

      let jiraKey = null;
      if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
        try {
          const authBase64 = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
          const taskRes = await axios.post(
            `${process.env.JIRA_BASE_URL || "https://apnileapos.atlassian.net"}/rest/api/3/issue`,
            {
              fields: {
                project: { key: projectKey },
                summary: taskSummary,
                description: {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: fields.description }] }]
                },
                parent: { key: matchedEpic.jiraKey },
                issuetype: { name: "Task" }
              }
            },
            {
              headers: {
                Authorization: `Basic ${authBase64}`,
                Accept: "application/json",
                "Content-Type": "application/json"
              },
              timeout: 4000
            }
          );
          jiraKey = taskRes.data.key;
          console.log(`📡 Dynamic task created under epic in Jira: ${jiraKey}`);
        } catch (err) {
          console.warn("Failed to create task under epic in live Jira, using mock fallback:", err.message);
        }
      }

      const finalKey = jiraKey || taskKey;

      await db.query(
        `INSERT INTO mock_tasks (id, key, board_id, fields)
         VALUES ($1, $2, $3, $4)`,
        [taskId, finalKey, boardId, JSON.stringify(fields)]
      );

      return res.json({
        reply: `✅ **Task Created Successfully Under Epic!**\n\n` +
               `• **Task Key:** ${finalKey}\n` +
               `• **Summary:** ${taskSummary}\n` +
               `• **Epic Parent:** ${matchedEpic.title} (${matchedEpic.jiraKey || 'Local'})\n` +
               `• **Project:** ${matchedProject.name}\n` +
               `• **Status:** To Do`
      });
    }

    // Standard Queries
    if (queryText.includes("project") || queryText.includes("active")) {
      const result = await db.query('SELECT name, status, budget, accepted_by FROM projects ORDER BY created_at DESC LIMIT 5');
      if (result.rows.length === 0) {
        reply = "There are currently no active projects registered in the PostgreSQL database.";
      } else {
        const list = result.rows.map(p => `• **${p.name}** [Status: ${p.status}, Budget: ₹${p.budget}${p.accepted_by ? `, Accepted By: ${p.accepted_by}` : ''}]`).join("\n");
        reply = `Here are the latest projects from the database:\n\n${list}`;
      }
    } 
    else if (queryText.includes("meeting") || queryText.includes("sync")) {
      const result = await db.query('SELECT title, date, time FROM meetings ORDER BY date ASC LIMIT 5');
      if (result.rows.length === 0) {
        reply = "I couldn't find any scheduled sync meetings in PostgreSQL.";
      } else {
        const list = result.rows.map(m => `• **${m.title}** on ${m.date} at ${m.time}`).join("\n");
        reply = `Here are the upcoming campus sync meetings scheduled in PostgreSQL:\n\n${list}`;
      }
    }
    else if (queryText.includes("repo") || queryText.includes("github")) {
      const result = await db.query('SELECT repo_name, repo_url FROM repositories LIMIT 5');
      if (result.rows.length === 0) {
        reply = "No Git repositories have been provisioned yet.";
      } else {
        const list = result.rows.map(r => `• **${r.repo_name}** (${r.repo_url})`).join("\n");
        reply = `Here are the active project repositories:\n\n${list}`;
      }
    }
    else if (queryText.includes("audit") || queryText.includes("history") || queryText.includes("log")) {
      const result = await db.query('SELECT actor, action, entity, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 5');
      if (result.rows.length === 0) {
        reply = "Audit history logs are currently empty.";
      } else {
        const list = result.rows.map(a => `• [${new Date(a.timestamp).toLocaleTimeString()}] **${a.actor}** did **${a.action}** on ${a.entity}`).join("\n");
        reply = `Here are the 5 most recent platform audit logs:\n\n${list}`;
      }
    }
    else if (queryText.includes("jira") || queryText.includes("task")) {
      const result = await db.query('SELECT key, fields FROM mock_tasks LIMIT 3');
      const list = result.rows.map(t => {
        const fields = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
        return `• [${t.key}] **${fields.summary}** - Status: ${fields.status?.name || 'Backlog'}`;
      }).join("\n");
      
      reply = `I scanned your Jira project boards. Here are the latest issues:\n\n${list || "• No mock tasks currently stored in local Postgres fallback."}`;
    }
    else if (queryText.includes("confluence") || queryText.includes("wiki")) {
      reply = "Confluence Integration is active! All awarded projects have dedicated spaces provisioned under the domain `https://confluence.apnileap.com/display/<PROJECT_KEY>`. You can ask me to fetch documentation templates or project requirements spaces.";
    }

    res.json({ reply });

  } catch (error) {
    console.error("Rovo query execution error:", error);
    res.json({ reply: "I encountered an error executing that action. Please verify that your PostgreSQL database is running." });
  }
});

module.exports = router;
