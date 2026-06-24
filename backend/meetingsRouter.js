const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const { sendEmail } = require('./emailService');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_jwt_secret";

// JWT validation middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Malformed token" });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Failed to authenticate token" });
    req.user = decoded;
    next();
  });
};

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

// GET: Fetch upcoming scheduled meetings
router.get("/meetings", async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM meetings ORDER BY created_at DESC');
    // Map database properties back to camelCase for the frontend if needed
    const meetings = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      campusId: row.campus_id,
      date: row.date,
      time: row.time,
      link: row.link,
      agenda: row.agenda,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    res.json(meetings);
  } catch (error) {
    console.error("Failed to fetch meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

// POST: Schedule a new meeting
router.post("/meetings", verifyToken, async (req, res) => {
  const { id: customId, title, campusId, date, time, link, agenda } = req.body;
  if (!title || !campusId || !date || !time) {
    return res.status(400).json({ error: "Missing required meeting fields (title, campusId, date, time)" });
  }
  
  try {
    const id = customId || `meet-${Date.now()}`;
    const meetLink = link || "https://teams.microsoft.com/";
    const meetAgenda = agenda || "General campus sync.";

    await db.query(
      `INSERT INTO meetings (id, title, campus_id, date, time, link, agenda) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE 
       SET title = EXCLUDED.title, campus_id = EXCLUDED.campus_id, date = EXCLUDED.date, 
           time = EXCLUDED.time, link = EXCLUDED.link, agenda = EXCLUDED.agenda, updated_at = NOW()`,
      [id, title, campusId, date, time, meetLink, meetAgenda]
    );
    
    res.json({ 
      success: true, 
      meeting: { id, title, campusId, date, time, link: meetLink, agenda: meetAgenda } 
    });
  } catch (error) {
    console.error("Failed to schedule meeting:", error);
    res.status(500).json({ error: "Failed to schedule meeting" });
  }
});

// GET: Retrieve messages for a specific meeting
router.get("/meetings/:meetingId/messages", verifyToken, async (req, res) => {
  const { meetingId } = req.params;
  try {
    const result = await db.query(
      'SELECT id, sender, text, issue_key as "issueKey", timestamp FROM meeting_messages WHERE meeting_id = $1 ORDER BY timestamp ASC',
      [meetingId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch meeting messages:", error);
    res.status(500).json({ error: "Failed to fetch meeting messages" });
  }
});

// POST: Post a message for a specific meeting
router.post("/meetings/:meetingId/messages", verifyToken, async (req, res) => {
  const { meetingId } = req.params;
  const { sender, text, issueKey } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Message text is required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO meeting_messages (meeting_id, sender, text, issue_key) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, sender, text, issue_key as "issueKey", timestamp`,
      [meetingId, sender || req.user.name || req.user.email, text, issueKey || null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to save meeting message:", error);
    res.status(500).json({ error: "Failed to save meeting message" });
  }
});

// POST: Remind endpoint compiling overdue/blocked tasks and sending warning emails
router.post("/meetings/:id/remind", verifyToken, async (req, res) => {

  const { id } = req.params;
  try {
    const meetRes = await db.query('SELECT * FROM meetings WHERE id = $1', [id]);
    if (meetRes.rows.length === 0) {
      return res.status(404).json({ error: "Sync meeting not found" });
    }
    const meeting = {
      id: meetRes.rows[0].id,
      title: meetRes.rows[0].title,
      campusId: meetRes.rows[0].campus_id,
      date: meetRes.rows[0].date,
      time: meetRes.rows[0].time,
      link: meetRes.rows[0].link,
      agenda: meetRes.rows[0].agenda
    };

    const spoke = SPOKES[meeting.campusId];
    if (!spoke) {
      return res.status(400).json({ error: "Invalid campus spoke associated with meeting" });
    }

    let tasks = [];
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

    // Fetch JIRA issues if JIRA credentials are provided
    if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
      try {
        const jql = `project = ${JIRA_PROJECT} ORDER BY created DESC`;
        const response = await axios.post(
          `${JIRA_BASE}/rest/api/3/search/jql`,
          {
            jql,
            maxResults: 100,
            fields: [
              "summary", "status", "assignee", "priority",
              "issuetype", "created", "updated", "resolution", "duedate", "labels"
            ]
          },
          {
            headers: {
              Authorization: `Basic ${authBase64}`,
              ...jiraHeaders
            },
            timeout: 5000
          }
        );
        let issues = response.data.issues || [];
        issues = issues.filter(issue => {
          const labels = issue.fields?.labels || [];
          const campusLabel = CAMPUS_LABELS[meeting.campusId];
          if (meeting.campusId === "3") {
            return labels.includes("kle-spoke") || (!labels.includes("rit-spoke") && !labels.includes("coep-spoke") && !labels.includes("mmcoep-spoke"));
          } else {
            return labels.includes(campusLabel);
          }
        });
        tasks = issues;
      } catch (err) {
        console.warn(`Failed to fetch live board issues, using local Postgres mock tasks if any:`, err.message);
      }
    }

    // Fall back or merge with PostgreSQL mock tasks for this board
    try {
      const mockResult = await db.query("SELECT * FROM mock_tasks WHERE board_id = $1", [meeting.campusId]);
      const mockTasks = mockResult.rows.map(row => ({
        id: row.id,
        key: row.key,
        fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields
      }));
      tasks = [...tasks, ...mockTasks];
    } catch (dbErr) {
      console.error("Failed to fetch mock tasks from Postgres:", dbErr.message);
    }

    const overdueTasks = [];
    const blockedTasks = [];
    const notifyCoordinators = new Set(["manasa@apnileap.com", "coordinator@" + spoke.key.toLowerCase() + ".edu"]);

    // Dynamic resolution of spoke members
    // 1. Database users
    try {
      const dbUsersRes = await db.query("SELECT email FROM users WHERE persona = $1", ["spoke-" + spoke.name.split(" ")[0].toLowerCase()]);
      dbUsersRes.rows.forEach(u => {
        if (u.email) notifyCoordinators.add(u.email.toLowerCase().trim());
      });
    } catch (err) {
      // Users table might not exist or be empty, ignore silently
    }

    // 2. Simulated team members
    const simulated = CAMPUS_TEAM_MEMBERS[meeting.campusId] || [];
    simulated.forEach(u => {
      const email = u.emailAddress || u.email;
      if (email) notifyCoordinators.add(email.toLowerCase().trim());
    });

    tasks.forEach(t => {
      const fields = t.fields || {};
      const issueType = fields.issuetype?.name || fields.issueType || "Task";
      if (issueType === "Epic") return;

      const summary = fields.summary || "Sprint task";
      const status = fields.status?.name || fields.status || "Backlog";
      const assigneeName = fields.assignee?.displayName || "Unassigned";
      const assigneeEmail = fields.assignee?.emailAddress || fields.assignee?.email || null;

      if (assigneeEmail) {
        notifyCoordinators.add(assigneeEmail);
      }

      // Check if flagged
      const isFlagged = fields.flagged === true || 
                        (fields.Flagged && fields.Flagged.length > 0) ||
                        (fields.customfield_10021 && fields.customfield_10021.length > 0);

      if (isFlagged) {
        blockedTasks.push({ key: t.key || t.id, summary, status, assignee: assigneeName });
      }

      // Check if overdue
      const dueDateStr = fields.duedate || fields.dueDate || null;
      if (status !== "Done" && dueDateStr) {
        const today = new Date("2026-05-27"); // Using standard project date anchor
        const due = new Date(dueDateStr);
        if (due.getTime() < today.getTime()) {
          overdueTasks.push({ key: t.key || t.id, summary, dueDate: dueDateStr, assignee: assigneeName });
        }
      }
    });
    const recipientList = Array.from(notifyCoordinators);
    const redirectEmail = process.env.SMTP_REDIRECT_TO || null;
    const finalTo = redirectEmail ? redirectEmail : recipientList.join(", ");

    const redirectBannerHtml = redirectEmail ? `
      <div style="background: rgba(251, 146, 60, 0.08); border: 1px dashed rgba(251, 146, 60, 0.25); border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #fb923c; text-align: center; line-height: 1.5;">
        ⚙️ <strong>[Demo Rerouting Mode Active]</strong><br/>
        This email was originally addressed to: <span style="font-family: monospace; font-weight: 750; color: #f97316;">${recipientList.join(", ")}</span>.<br/>
        It has been rerouted to your administrator address (<strong style="color: white;">${redirectEmail}</strong>) for live verification.
      </div>
    ` : "";

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #07090e; padding: 40px; color: #f3f4f6; min-height: 100%;">
        <div style="max-width: 650px; margin: 0 auto; background: rgba(17, 24, 39, 0.9); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: white;">ApniLeap Hub</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #e0e7ff;">🏫 Campus Sync Invitation & Warning Digest</p>
          </div>
          
          <div style="padding: 40px 30px; line-height: 1.6;">
            ${redirectBannerHtml}
            <h2 style="margin-top: 0; color: white; font-size: 18px; font-weight: 700;">Campus Sync & Deliverables Warning</h2>
            <p style="font-size: 14px; color: #9ca3af; margin-bottom: 24px;">
              A campus sync meeting is scheduled for <strong style="color: #6366f1;">${spoke.name}</strong>. Please review the agenda and the current active sprint blockers/overdue items compiled for your spoke.
            </p>

            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: white;">📅 Meeting Details</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-weight: 600; width: 100px;">Title:</td>
                  <td style="padding: 4px 0; color: #f3f4f6; font-weight: 700;">${meeting.title}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Time:</td>
                  <td style="padding: 4px 0; color: #6366f1; font-weight: 700;">${meeting.date} at ${meeting.time}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Agenda:</td>
                  <td style="padding: 4px 0; color: #9ca3af;">${meeting.agenda}</td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 24px;">
              <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #f43f5e;">
                🚨 Active Campus Blockers (${blockedTasks.length})
              </h3>
              ${blockedTasks.length === 0 ? `
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; text-align: center; color: #10b981; font-size: 13px;">
                  None! Excellent team progression.
                </div>
              ` : `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <th style="padding: 10px; color: #9ca3af;">Key</th>
                      <th style="padding: 10px; color: #9ca3af;">Summary</th>
                      <th style="padding: 10px; color: #9ca3af;">Status</th>
                      <th style="padding: 10px; color: #9ca3af;">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${blockedTasks.map(t => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <td style="padding: 10px; font-family: monospace; color: #6366f1; font-weight: 700;">${t.key}</td>
                        <td style="padding: 10px; color: #f3f4f6; font-weight: 600;">${t.summary}</td>
                        <td style="padding: 10px;"><span style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">${t.status}</span></td>
                        <td style="padding: 10px; color: #9ca3af;">${t.assignee}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              `}
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #fb923c;">
                ⏰ Overdue Deadlines (${overdueTasks.length})
              </h3>
              ${overdueTasks.length === 0 ? `
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; text-align: center; color: #10b981; font-size: 13px;">
                  None! All sprint tasks are currently on track.
                </div>
              ` : `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
                      <th style="padding: 10px; color: #9ca3af;">Key</th>
                      <th style="padding: 10px; color: #9ca3af;">Summary</th>
                      <th style="padding: 10px; color: #9ca3af;">Due Date</th>
                      <th style="padding: 10px; color: #9ca3af;">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${overdueTasks.map(t => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <td style="padding: 10px; font-family: monospace; color: #6366f1; font-weight: 700;">${t.key}</td>
                        <td style="padding: 10px; color: #f3f4f6; font-weight: 600;">${t.summary}</td>
                        <td style="padding: 10px; color: #fb923c; font-weight: 700;">⏰ ${t.dueDate}</td>
                        <td style="padding: 10px; color: #9ca3af;">${t.assignee}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              `}
            </div>

            <div style="text-align: center;">
              <a href="${meeting.link}" target="_blank" style="background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);">
                Join Live Sync Room
              </a>
            </div>
          </div>

          <div style="background-color: rgba(255, 255, 255, 0.01); padding: 20px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #6b7280;">
            This pre-meeting compilation alert was dispatched automatically by ApniLeap Hub.<br/>
            To update SMTP credentials, configure environmental variables inside the backend .env file.
          </div>
        </div>
      </div>
    `;

    const textBody = `Meeting: ${meeting.title}\nCampus: ${spoke.name}\nTime: ${meeting.date} at ${meeting.time}\n\nOverdue Tasks: ${overdueTasks.length}\nBlocked Tasks: ${blockedTasks.length}`;

    const info = await sendEmail({
      to: finalTo,
      subject: `🚨 [Warning Digest] Campus Sync Prep: ${meeting.title} (${spoke.name})`,
      body: textBody,
      html: htmlTemplate,
      type: 'warning'
    });

    res.json({
      success: true,
      message: `Pre-meeting alerts successfully dispatched to ${recipientList.length} campus coordinators!`,
      notifiedEmails: recipientList,
      overdueCount: overdueTasks.length,
      blockerCount: blockedTasks.length,
      emailId: info.id
    });
  } catch (error) {
    console.error("Prep Reminder Dispatch Error:", error.message);
    res.status(500).json({ error: `Reminder failed: ${error.message}` });
  }
});

// DELETE: Delete a meeting
router.delete("/meetings/:meetId", verifyToken, async (req, res) => {
  const { meetId } = req.params;
  try {
    const result = await db.query('DELETE FROM meetings WHERE id = $1 RETURNING *', [meetId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    res.json({ success: true, message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("Failed to delete meeting:", error);
    res.status(500).json({ error: "Failed to delete meeting" });
  }
});

module.exports = router;
