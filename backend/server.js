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

const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");

// ── JWT & Encryption config ──────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "fallback_jwt_secret";
const ENCRYPTION_SECRET = process.env.CHAT_ENCRYPTION_SECRET 
  ? Buffer.from(process.env.CHAT_ENCRYPTION_SECRET, 'hex') 
  : crypto.randomBytes(32); // Fallback to a random key if not in env
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_SECRET, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  try {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_SECRET, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    // Return placeholder if decryption fails (e.g. key changed)
    return "[Encrypted Message]";
  }
}

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

// ── Jira config (env-driven with safe defaults) ───────────────────────────────
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

const getAtlassianOrgHeaders = () => {
  const orgToken = process.env.ATLASSIAN_ORG_TOKEN || process.env.ATLASSIAN_ORG_API_KEY;
  if (orgToken) {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${orgToken}`
    };
  }
  const currentAuth = getJiraAuth();
  const authBase64 = Buffer.from(`${currentAuth.username}:${currentAuth.password}`).toString('base64');
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Basic ${authBase64}`
  };
};

// ── Helper: fetch all issues with rich fields ─────────────────────────────────
async function fetchAllIssues() {
  const response = await axios.post(
    `${getJiraBase()}/rest/api/3/search/jql`,
    {
      jql: `project = ${getJiraProject()} ORDER BY created DESC`,
      maxResults: 100,
      fields: [
        "summary", "status", "assignee", "priority",
        "issuetype", "created", "updated", "resolution",
      ],
    },
    { auth: getJiraAuth(), headers: jiraHeaders }
  );
  return response.data.issues || [];
}

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── GET /settings ──────────────────────────────────────────────────────────────
app.get("/settings", (req, res) => {
  res.json({
    jiraBaseUrl: getJiraBase(),
    jiraProjectKey: getJiraProject(),
    jiraEmail: process.env.JIRA_EMAIL || "",
    atlassianOrgId: process.env.ATLASSIAN_ORG_ID || "3e8909b9-234a-4def-aaf9-adc97997b269",
    jiraApiToken: process.env.JIRA_API_TOKEN ? "••••••••••••••••" : "",
    apiVersion: "Jira Cloud REST v3",
    status: process.env.JIRA_API_TOKEN ? "Connected" : "Disconnected"
  });
});

// ── POST /settings ─────────────────────────────────────────────────────────────
app.post("/settings", async (req, res) => {
  try {
    const { jiraBaseUrl, jiraProjectKey, jiraEmail, atlassianOrgId, jiraApiToken } = req.body;

    if (!jiraBaseUrl || !jiraEmail) {
      return res.status(400).json({ error: "Site URL and Email are required." });
    }

    // Determine the actual API token to use (keep existing if sent as masked)
    let finalToken = jiraApiToken;
    if (!finalToken || finalToken.includes("••••")) {
      finalToken = process.env.JIRA_API_TOKEN;
    }

    if (!finalToken) {
      return res.status(400).json({ error: "Jira API Token is required." });
    }

    // Try a test connection to Atlassian Jira /rest/api/3/myself to validate credentials
    try {
      const authObj = {
        username: jiraEmail,
        password: finalToken
      };
      await axios.get(`${jiraBaseUrl}/rest/api/3/myself`, {
        auth: authObj,
        headers: { Accept: "application/json" },
        timeout: 8000
      });
    } catch (testErr) {
      console.error("Test connection to Jira failed:", testErr.response?.data || testErr.message);
      let errorDetails = testErr.message;
      if (testErr.response?.status === 401) {
        errorDetails = "Unauthorized (401). Please check your Email and API Token.";
      } else if (testErr.response?.status === 404) {
        errorDetails = "Not Found (404). Please verify your Atlassian Site URL.";
      } else if (testErr.code === "ENOTFOUND") {
        errorDetails = "DNS Lookup Failed. The Site URL is unreachable.";
      } else if (testErr.response?.data?.errorMessages) {
        errorDetails = testErr.response.data.errorMessages.join(", ");
      }
      return res.status(422).json({ error: `Connection test failed: ${errorDetails}` });
    }

    // Temporarily set env variables so helper functions (getJiraBase, getJiraAuth) work
    process.env.JIRA_BASE_URL = jiraBaseUrl;
    process.env.JIRA_EMAIL = jiraEmail;
    process.env.JIRA_API_TOKEN = finalToken;

    // 1. Auto-fetch Atlassian Site ID (Cloud ID)
    let finalSiteId = "";
    try {
      const tenantRes = await axios.get(`${jiraBaseUrl}/_edge/tenant_info`, { timeout: 5000 });
      if (tenantRes.data && tenantRes.data.cloudId) {
        finalSiteId = tenantRes.data.cloudId;
        console.log("Automatically detected site ID (Cloud ID):", finalSiteId);
        process.env.ATLASSIAN_SITE_ID = finalSiteId;
      }
    } catch (err) {
      console.error("Failed to auto-fetch Site ID:", err.message);
    }

    // 2. Auto-fetch Jira Project Key if not provided
    let finalProjectKey = jiraProjectKey ? jiraProjectKey.trim().toUpperCase() : "";
    if (!finalProjectKey) {
      try {
        const projRes = await axios.get(`${jiraBaseUrl}/rest/api/3/project`, {
          auth: { username: jiraEmail, password: finalToken },
          headers: { Accept: "application/json" },
          timeout: 5000
        });
        if (Array.isArray(projRes.data) && projRes.data.length > 0) {
          finalProjectKey = projRes.data[0].key;
          console.log("Automatically selected first project key:", finalProjectKey);
        }
      } catch (projErr) {
        console.error("Failed to auto-fetch project key:", projErr.message);
      }
    }

    // If project key is still blank, automatically create a default project key!
    if (!finalProjectKey) {
      console.log("No Jira Project Key provided or found in settings. Auto-creating a default project key inside Atlassian...");
      try {
        finalProjectKey = await autoCreateJiraProject("APNILEAP Default Board");
        console.log(`Auto-created Jira project successfully: ${finalProjectKey}`);
      } catch (createErr) {
        console.error("Failed to automatically create Jira project during settings configuration:", createErr.message);
        return res.status(520).json({ error: `Verification succeeded, but failed to automatically create a default Jira project: ${createErr.message}` });
      }
    }

    // Update process.env in-memory so they are active instantly
    process.env.JIRA_PROJECT_KEY = finalProjectKey;

    let finalOrgId = atlassianOrgId ? atlassianOrgId.trim() : "";
    if (!finalOrgId) {
      finalOrgId = process.env.ATLASSIAN_ORG_ID || "3e8909b9-234a-4def-aaf9-adc97997b269";
    }
    process.env.ATLASSIAN_ORG_ID = finalOrgId;

    // Persist to backend/.env
    const envPath = path.join(__dirname, ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    // Function to set or replace env variable
    const updateEnvVar = (content, key, val) => {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${val}`);
      } else {
        return content + (content.endsWith("\n") ? "" : "\n") + `${key}=${val}\n`;
      }
    };

    let updatedContent = envContent;
    updatedContent = updateEnvVar(updatedContent, "JIRA_BASE_URL", jiraBaseUrl);
    updatedContent = updateEnvVar(updatedContent, "JIRA_PROJECT_KEY", finalProjectKey);
    updatedContent = updateEnvVar(updatedContent, "JIRA_EMAIL", jiraEmail);
    updatedContent = updateEnvVar(updatedContent, "JIRA_API_TOKEN", finalToken);
    updatedContent = updateEnvVar(updatedContent, "ATLASSIAN_ORG_ID", finalOrgId);
    if (finalSiteId) {
      updatedContent = updateEnvVar(updatedContent, "ATLASSIAN_SITE_ID", finalSiteId);
    }

    fs.writeFileSync(envPath, updatedContent, "utf8");

    res.json({
      message: "Atlassian integration configured and verified successfully!",
      jiraBaseUrl,
      jiraProjectKey: finalProjectKey,
      jiraEmail,
      atlassianOrgId: finalOrgId,
      atlassianSiteId: finalSiteId
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Helper: Automatically create a new Jira project in Atlassian ──────────────
async function autoCreateJiraProject(projectTitle) {
  try {
    const jiraBase = getJiraBase();
    const jiraAuth = getJiraAuth();

    if (!jiraAuth.username || !jiraAuth.password) {
      console.warn("Jira credentials not configured. Using fallback project key.");
      return "APNI" + Math.floor(100 + Math.random() * 900);
    }

    // 1. Fetch current user account ID to set as lead
    const userRes = await axios.get(`${jiraBase}/rest/api/3/myself`, {
      auth: jiraAuth,
      headers: { Accept: "application/json" },
      timeout: 5000
    });
    const leadAccountId = userRes.data.accountId;

    // 2. Generate a clean uppercase unique key from the project title
    let cleanKey = projectTitle
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .map(w => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 10);
    
    // Ensure key is at least 3 letters, fallback if too short
    if (cleanKey.length < 3) {
      cleanKey = (cleanKey + "PROJ").slice(0, 4).toUpperCase();
    }

    // Append some random digit to prevent key conflicts in Atlassian
    cleanKey = `${cleanKey}${Math.floor(10 + Math.random() * 90)}`;

    console.log(`Auto-creating Jira project with key: ${cleanKey} and name: ${projectTitle}`);

    // 3. Create project in Jira Cloud
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
    const fallbackKey = "APNI" + Math.floor(100 + Math.random() * 900);
    return fallbackKey;
  }
}

// ── GET /users ────────────────────────────────────────────────────────────────
app.get("/users", async (req, res) => {
  try {
    const response = await axios.get(
      `${getJiraBase()}/rest/api/3/user/assignable/search?project=${getJiraProject()}`,
      { auth: getJiraAuth(), headers: jiraHeaders }
    );
    const users = response.data.map(u => ({
      accountId: u.accountId,
      displayName: u.displayName,
      avatarUrl: u.avatarUrls?.["24x24"] || "",
      active: u.active
    }));
    res.json(users);
  } catch (error) {
    console.warn("Failed to fetch live assignable users, falling back to mock team members:", error.message);
    const mockUsers = [
      { accountId: "mock-user-1", displayName: "Rahul Sharma (Student)", avatarUrl: "", active: true },
      { accountId: "mock-user-2", displayName: "Priya Patel (Student)", avatarUrl: "", active: true },
      { accountId: "mock-user-3", displayName: "Dr. Ramesh Patil (PI)", avatarUrl: "", active: true },
      { accountId: "mock-user-4", displayName: "Sanjay Sen (Infosys Mentor)", avatarUrl: "", active: true }
    ];
    res.json(mockUsers);
  }
});

// ── POST /issues ──────────────────────────────────────────────────────────────
app.post("/issues", async (req, res) => {
  try {
    const { summary, description, assigneeId, reporterId, priority, status, dueDate } = req.body;

    if (!summary) {
      return res.status(400).json({ error: "Summary is required" });
    }

    const adfDescription = description
      ? {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description
                }
              ]
            }
          ]
        }
      : undefined;

    const issueData = {
      fields: {
        project: {
          key: getJiraProject()
        },
        summary: summary,
        description: adfDescription,
        issuetype: {
          name: "Task"
        },
        priority: priority ? { name: priority } : undefined,
        duedate: dueDate || undefined
      }
    };

    if (assigneeId) {
      issueData.fields.assignee = { accountId: assigneeId };
    } else if (assigneeId === null) {
      issueData.fields.assignee = null;
    }

    if (reporterId) {
      issueData.fields.reporter = { accountId: reporterId };
    }

    const createRes = await axios.post(
      `${getJiraBase()}/rest/api/3/issue`,
      issueData,
      { auth: getJiraAuth(), headers: jiraHeaders }
    );

    const issueKey = createRes.data.key;
    const issueId = createRes.data.id;

    // Explicitly transition to status (default to "To Do") so it is pushed to the board automatically
    const targetStatus = status || "To Do";
    const transitionMap = {
      "to do": "11",
      "todo": "11",
      "in progress": "21",
      "in review": "31",
      "testing": "41",
      "done": "51"
    };
    
    const transitionId = transitionMap[targetStatus.toLowerCase()];
    if (transitionId) {
      try {
        await axios.post(
          `${getJiraBase()}/rest/api/3/issue/${issueKey}/transitions`,
          { transition: { id: transitionId } },
          { auth: getJiraAuth(), headers: jiraHeaders }
        );
      } catch (transitionErr) {
        console.error(`Failed to transition issue ${issueKey} to ${targetStatus}:`, transitionErr.response?.data || transitionErr.message);
      }
    }

    res.json({ id: issueId, key: issueKey, message: "Issue created successfully" });
  } catch (error) {
    console.error("Error /issues (POST):", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});


// ── Projects, Spokes & Email Helpers ──
const PROJECTS_FILE = path.join(__dirname, "projects.json");
const SPOKES_FILE = path.join(__dirname, "spokes.json");
const SENT_EMAILS_FILE = path.join(__dirname, "sent_emails.json");

const { sendEmail } = require("./emailService");

function readProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading projects:", err);
  }
  return [];
}

function writeProjects(projects) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Error writing projects file:", err);
    return false;
  }
}

function readSpokes() {
  try {
    if (fs.existsSync(SPOKES_FILE)) {
      return JSON.parse(fs.readFileSync(SPOKES_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading spokes:", err);
  }
  return [];
}

// ── POST /login ────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const db = require('./db');
    const result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid password." });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      collegeId: user.college_id
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: userPayload });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: `Internal server login error: ${error.message}` });
  }
});

// ── GET /api/v1/users ──────────────────────────────────────────────────────────
app.get("/api/v1/users", verifyToken, async (req, res) => {
  if (req.user.role !== 'Super-admin') {
    return res.status(403).json({ error: "Forbidden. Super-admin access required." });
  }
  try {
    const db = require('./db');
    const result = await db.query('SELECT id, email, name, role, college_id FROM users ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── POST /api/v1/users ─────────────────────────────────────────────────────────
app.post("/api/v1/users", verifyToken, async (req, res) => {
  if (req.user.role !== 'Super-admin') {
    return res.status(403).json({ error: "Forbidden. Super-admin access required." });
  }
  const { email, name, role, password, collegeId } = req.body;
  if (!email || !name || !role) {
    return res.status(400).json({ error: "Missing required fields (email, name, role)" });
  }
  try {
    const db = require('./db');
    const pass = password || "Admin@123";
    const result = await db.query(
      `INSERT INTO users (email, name, role, password, college_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, name, role, college_id`,
      [email.toLowerCase().trim(), name, role, pass, collegeId || null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user. Ensure email is unique." });
  }
});

// ── PUT /api/v1/users/:id ──────────────────────────────────────────────────────
app.put("/api/v1/users/:id", verifyToken, async (req, res) => {
  if (req.user.role !== 'Super-admin') {
    return res.status(403).json({ error: "Forbidden. Super-admin access required." });
  }
  const { id } = req.params;
  const { email, name, role, password, collegeId } = req.body;
  try {
    const db = require('./db');
    const updateResult = await db.query(
      `UPDATE users 
       SET email = COALESCE($1, email),
           name = COALESCE($2, name),
           role = COALESCE($3, role),
           password = COALESCE($4, password),
           college_id = COALESCE($5, college_id)
       WHERE id = $6
       RETURNING id, email, name, role, college_id`,
      [email ? email.toLowerCase().trim() : null, name, role, password, collegeId, id]
    );
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ── DELETE /api/v1/users/:id ───────────────────────────────────────────────────
app.delete("/api/v1/users/:id", verifyToken, async (req, res) => {
  if (req.user.role !== 'Super-admin') {
    return res.status(403).json({ error: "Forbidden. Super-admin access required." });
  }
  const { id } = req.params;
  try {
    const db = require('./db');
    const deleteResult = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});


// ── GET /teams ────────────────────────────────────────────────────────────────
app.get("/teams", async (req, res) => {
  try {
    const db = require('./db');
    const orgId = process.env.ATLASSIAN_ORG_ID || "3e8909b9-234a-4def-aaf9-adc97997b269";
    const siteId = process.env.ATLASSIAN_SITE_ID || "";
    let atlassianTeams = [];
    try {
      let getUrl = `https://api.atlassian.com/public/teams/v1/org/${orgId}/teams`;
      if (siteId) {
        getUrl += `?siteId=${siteId}`;
      }
      const response = await axios.get(
        getUrl,
        {
          headers: getAtlassianOrgHeaders()
        }
      );
      atlassianTeams = response.data.entities || [];
    } catch (err) {
      console.warn("Failed to fetch Atlassian teams, falling back to local teams only:", err.message);
    }

    const localTeamsRes = await db.query('SELECT * FROM teams');
    const localMessagesRes = await db.query('SELECT * FROM team_messages');

    const messagesByTeam = {};
    localMessagesRes.rows.forEach(msg => {
      if (!messagesByTeam[msg.team_id]) {
        messagesByTeam[msg.team_id] = [];
      }
      messagesByTeam[msg.team_id].push({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        issueKey: msg.issue_key,
        timestamp: msg.timestamp
      });
    });

    const localTeams = localTeamsRes.rows.map(row => ({
      id: row.id,
      name: row.name,
      members: row.members || [],
      messages: messagesByTeam[row.id] || []
    }));
    
    const mergedTeams = atlassianTeams.map(atTeam => {
      const matchingLocal = localTeams.find(lt => lt.id === atTeam.teamId) || { messages: [] };
      return {
        id: atTeam.teamId,
        name: atTeam.displayName,
        description: atTeam.description,
        members: [], 
        messages: matchingLocal.messages || []
      };
    });

    localTeams.forEach(lt => {
      if (!mergedTeams.find(mt => mt.id === lt.id)) {
        mergedTeams.push(lt);
      }
    });

    res.json(mergedTeams);
  } catch (error) {
    console.error("Error /teams:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /teams ───────────────────────────────────────────────────────────────
app.post("/teams", async (req, res) => {
  try {
    const db = require('./db');
    const { name, members } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const orgId = process.env.ATLASSIAN_ORG_ID || "3e8909b9-234a-4def-aaf9-adc97997b269";
    const siteId = process.env.ATLASSIAN_SITE_ID || "";
    let jiraTeamId = null;

    try {
      const payload = {
        displayName: name,
        description: "Created via Dashboard"
      };
      if (siteId) {
        payload.siteId = siteId;
      }
      const jiraRes = await axios.post(
        `https://api.atlassian.com/public/teams/v1/org/${orgId}/teams`,
        payload,
        {
          headers: getAtlassianOrgHeaders()
        }
      );
      
      if (jiraRes.data && jiraRes.data.teamId) {
        jiraTeamId = jiraRes.data.teamId;
      } else if (jiraRes.data && jiraRes.data.team) {
        jiraTeamId = jiraRes.data.team.teamId || jiraRes.data.team.id;
      } else if (jiraRes.data && jiraRes.data.id) {
        jiraTeamId = jiraRes.data.id;
      }
    } catch (err) {
      console.warn("Failed to create team in Jira:", err.response?.data || err.message);
    }

    const newTeamId = jiraTeamId || "team-" + Date.now();
    const newTeamMembers = Array.isArray(members) ? members : [];

    await db.query(
      'INSERT INTO teams (id, name, members) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, members = $3',
      [newTeamId, name, newTeamMembers]
    );

    res.json({
      id: newTeamId,
      name,
      members: newTeamMembers,
      messages: []
    });
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /teams/:id ────────────────────────────────────────────────────────────
app.put("/teams/:id", async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { name, members } = req.body;
    
    const checkTeam = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (checkTeam.rows.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }
    
    const updatedName = name || checkTeam.rows[0].name;
    const updatedMembers = members !== undefined ? (Array.isArray(members) ? members : []) : checkTeam.rows[0].members;
    
    await db.query(
      'UPDATE teams SET name = $1, members = $2 WHERE id = $3',
      [updatedName, updatedMembers, id]
    );
    
    res.json({
      id,
      name: updatedName,
      members: updatedMembers
    });
  } catch (error) {
    console.error("Error updating team:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /teams/:id/messages ───────────────────────────────────────────────────
app.get("/teams/:id/messages", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    
    const messagesRes = await db.query('SELECT * FROM team_messages WHERE team_id = $1 ORDER BY timestamp ASC', [id]);
    
    const decryptedMessages = messagesRes.rows.map(msg => ({
      id: msg.id,
      sender: msg.sender,
      text: decrypt(msg.text),
      issueKey: msg.issue_key,
      timestamp: msg.timestamp
    }));
    
    res.json(decryptedMessages);
  } catch (error) {
    console.error("Error getting team messages:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /teams/:id/messages ──────────────────────────────────────────────────
app.post("/teams/:id/messages", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { sender, text, issueKey, teamName } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Message text is required" });
    }
    
    const checkTeam = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (checkTeam.rows.length === 0) {
      await db.query(
        'INSERT INTO teams (id, name, members) VALUES ($1, $2, $3)',
        [id, teamName || "Atlassian Team", []]
      );
    }
    
    const encryptedText = encrypt(text);
    const newMessageId = "msg-" + Date.now() + Math.random().toString(36).substr(2, 5);
    const senderName = sender || req.user?.name || "Unknown";
    const iKey = issueKey || null;
    const now = new Date();

    await db.query(
      'INSERT INTO team_messages (id, team_id, sender, text, issue_key, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
      [newMessageId, id, senderName, encryptedText, iKey, now]
    );
    
    res.json({
      id: newMessageId,
      sender: senderName,
      text: text,
      issueKey: iKey,
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error("Error posting team message:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /issues/:key ─────────────────────────────────────────────────────────
app.put("/issues/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { assigneeId, reporterId, status } = req.body;

    const fieldsToUpdate = {};

    if (assigneeId !== undefined) {
      fieldsToUpdate.assignee = assigneeId ? { accountId: assigneeId } : null;
    }

    if (reporterId !== undefined) {
      fieldsToUpdate.reporter = reporterId ? { accountId: reporterId } : null;
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      await axios.put(
        `${getJiraBase()}/rest/api/3/issue/${key}`,
        { fields: fieldsToUpdate },
        { auth: getJiraAuth(), headers: jiraHeaders }
      );
    }

    if (status) {
      const transitionMap = {
        "to do": "11",
        "todo": "11",
        "in progress": "21",
        "in review": "31",
        "testing": "41",
        "done": "51"
      };
      
      const transitionId = transitionMap[status.toLowerCase()];
      if (transitionId) {
        await axios.post(
          `${getJiraBase()}/rest/api/3/issue/${key}/transitions`,
          { transition: { id: transitionId } },
          { auth: getJiraAuth(), headers: jiraHeaders }
        );
      }
    }

    res.json({ message: `Issue ${key} updated successfully` });
  } catch (error) {
    console.error(`Error updating issue ${req.params.key}:`, error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ── GET /issues/:key/comments ────────────────────────────────────────────────
app.get("/issues/:key/comments", async (req, res) => {
  try {
    const { key } = req.params;
    const response = await axios.get(
      `${getJiraBase()}/rest/api/3/issue/${key}/comment`,
      { auth: getJiraAuth(), headers: jiraHeaders }
    );
    res.json(response.data.comments || []);
  } catch (error) {
    console.error(`Error getting comments for ${req.params.key}:`, error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ── POST /issues/:key/comments ───────────────────────────────────────────────
app.post("/issues/:key/comments", async (req, res) => {
  try {
    const { key } = req.params;
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ error: "Comment body is required" });
    }

    const commentData = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: body
              }
            ]
          }
        ]
      }
    };

    const response = await axios.post(
      `${getJiraBase()}/rest/api/3/issue/${key}/comment`,
      commentData,
      { auth: getJiraAuth(), headers: jiraHeaders }
    );

    res.json(response.data);
  } catch (error) {
    console.error(`Error posting comment for ${req.params.key}:`, error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
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

// ── GET /spokes ──────────────────────────────────────────────────────────────
app.get("/spokes", (req, res) => {
  try {
    const spokes = readSpokes();
    res.json(spokes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /projects ────────────────────────────────────────────────────────────
app.get("/projects", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { role, collegeId, name } = req.user;

    const result = await db.query(
      `SELECT p.id as "id", p.name as "title", c.name as "company", 
              p.description, p.budget as "funding", p.duration_weeks || ' Weeks' as "duration", 
              p.status, p.confluence_space_url, p.jira_board_url, p.created_at as "createdAt"
       FROM projects p
       LEFT JOIN companies c ON p.company_id = c.id
       ORDER BY p.created_at DESC`
    );

    let projects = result.rows.map(row => ({
      ...row,
      id: `proj-${row.id}`,
      funding: parseFloat(row.funding),
      status: row.status.toLowerCase()
    }));

    // Moderator/Admin sees everything
    if (role === "Super-admin" || role === "Admin") {
      return res.json(projects);
    }

    // Spoke SPOC sees only projects assigned to their Spoke
    if (role === "College-SPOC") {
      const filtered = projects.filter(p => p.spokeId === collegeId);
      return res.json(filtered);
    }

    // Team Member or other roles: read teams from PostgreSQL and filter projects assigned to their teams
    const teamsRes = await db.query('SELECT * FROM teams');
    const userTeams = teamsRes.rows.filter(t => {
      return Array.isArray(t.members) && t.members.some(memberId => {
        return memberId === req.user.email || memberId.includes(name);
      });
    });

    const userTeamIds = userTeams.map(t => t.id);
    const filtered = projects.filter(p => p.teamId && userTeamIds.includes(p.teamId));
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /projects (Intake B2B Proposal) ──────────────────────────────────────
app.post("/projects", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden. Only Administrators can create projects." });
    }
    const { title, company, description, funding, duration, epics } = req.body;
    if (!title || !company) {
      return res.status(400).json({ error: "Title and Company are required." });
    }

    const projects = readProjects();
    const autoKey = await autoCreateJiraProject(title);

    // Save to PostgreSQL Database
    const db = require('./db');
    let companyId = null;
    
    // Find or create company
    try {
      const compCheck = await db.query('SELECT id FROM companies WHERE name ILIKE $1', [company.trim()]);
      if (compCheck.rows.length > 0) {
        companyId = compCheck.rows[0].id;
      } else {
        const compInsert = await db.query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [company.trim()]);
        companyId = compInsert.rows[0].id;
      }
    } catch (dbErr) {
      console.error("Failed to map company in DB:", dbErr.message);
    }

    const numericId = Date.now();
    let dbSuccess = false;
    
    try {
      let durationWeeks = 12;
      if (duration) {
        const num = parseInt(duration);
        if (!isNaN(num)) {
          durationWeeks = duration.toLowerCase().includes('month') ? num * 4 : num;
        }
      }
      
      await db.query(
        `INSERT INTO projects (id, name, description, budget, duration_weeks, status, company_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [numericId, title, description || "", Number(funding) || 0, durationWeeks, 'OPEN_FOR_BIDDING', companyId]
      );
      dbSuccess = true;
    } catch (dbErr) {
      console.error("Failed to insert project in DB:", dbErr.message);
    }

    const newProject = {
      id: dbSuccess ? `proj-${numericId}` : "proj-" + Date.now(),
      title,
      company,
      description: description || "",
      funding: Number(funding) || 0,
      duration: duration || "3 Months",
      status: "open_for_bidding",
      spokeId: null,
      teamId: null,
      jiraProjectKey: autoKey,
      epics: Array.isArray(epics) ? epics.map((e, idx) => ({
        id: `epic-${Date.now()}-${idx}`,
        title: e.title || `Epic ${idx + 1}`,
        description: e.description || "",
        jiraKey: null,
        status: "To Do"
      })) : [],
      reminders: [],
      createdAt: new Date().toISOString()
    };

    projects.unshift(newProject);
    writeProjects(projects);
    res.json(newProject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /projects/:id/assign-spoke ───────────────────────────────────────────
app.post("/projects/:id/assign-spoke", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { spokeId } = req.body;

    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden. Only moderators can allocate projects to Spokes." });
    }

    const projects = readProjects();
    const projIdx = projects.findIndex(p => p.id === id);
    if (projIdx === -1) {
      return res.status(404).json({ error: "Project not found." });
    }

    const spokes = readSpokes();
    const spoke = spokes.find(s => s.id === spokeId);
    if (!spoke) {
      return res.status(400).json({ error: "Invalid Spoke ID." });
    }

    projects[projIdx].spokeId = spokeId;
    projects[projIdx].status = "allocated"; // Match Pill "ALLOCATED" state in screenshot

    // Trigger automated email reminder to Spoke SPOC
    const spocEmail = spoke.spocEmail || "spoc@college.edu";
    const emailSubject = `New Project Assigned: ${projects[projIdx].title}`;
    const emailBody = `Dear ${spoke.spocName || "Spoke SPOC"},\n\n` +
      `The B2B project "${projects[projIdx].title}" from ${projects[projIdx].company} has been assigned to ${spoke.name}.\n` +
      `Please log into the portal to review the Epics, sync them to Jira, and assign a team.\n\n` +
      `Best regards,\nApni Leap Moderator Portal`;

    const emailLog = await sendEmail({
      to: spocEmail,
      subject: emailSubject,
      body: emailBody,
      type: "allocation"
    });

    if (!Array.isArray(projects[projIdx].reminders)) {
      projects[projIdx].reminders = [];
    }
    projects[projIdx].reminders.push(emailLog);

    writeProjects(projects);
    res.json(projects[projIdx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /projects/:id/accept ────────────────────────────────────────────────
app.post("/projects/:id/accept", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const projects = readProjects();
    const projIdx = projects.findIndex(p => p.id === id);
    if (projIdx === -1) {
      return res.status(404).json({ error: "Project not found." });
    }

    const project = projects[projIdx];
    
    // Check permission: Super-admin, Admin, or Faculty for this specific Spoke
    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      if ((req.user.role !== "Faculty" && req.user.role !== "Principal-Investigator") || req.user.collegeId !== project.spokeId) {
        return res.status(403).json({ error: "Forbidden. Only Faculty Handlers or Administrators can accept projects." });
      }
    }

    project.status = "accepted"; 

    writeProjects(projects);
    res.json(project);
  } catch (err) {
    console.error("Error accepting project:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /projects/:id/decline ────────────────────────────────────────────────
app.post("/projects/:id/decline", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const projects = readProjects();
    const projIdx = projects.findIndex(p => p.id === id);
    if (projIdx === -1) {
      return res.status(404).json({ error: "Project not found." });
    }

    const project = projects[projIdx];
    
    // Check permission: Super-admin, Admin, or Faculty for this specific Spoke
    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      if ((req.user.role !== "Faculty" && req.user.role !== "Principal-Investigator") || req.user.collegeId !== project.spokeId) {
        return res.status(403).json({ error: "Forbidden. Only Faculty Handlers or Administrators can decline projects." });
      }
    }

    // Reset status to pending_review and clear spokeId & teamId
    project.status = "pending_review";
    project.spokeId = null;
    project.teamId = null;

    writeProjects(projects);
    res.json(project);
  } catch (err) {
    console.error("Error declining project:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /projects/:id/epics (Add Epic and Sync to Jira) ──────────────────────
app.post("/projects/:id/epics", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Epic title is required." });
    }

    const projects = readProjects();
    const projIdx = projects.findIndex(p => p.id === id);
    if (projIdx === -1) {
      return res.status(404).json({ error: "Project not found." });
    }

    const project = projects[projIdx];

    // Check permission: Super-admin, College-SPOC, or member of the assigned team
    let hasAccess = false;
    if (req.user.role === "Super-admin" || req.user.role === "Admin") {
      hasAccess = true;
    } else if (req.user.role === "College-SPOC" && req.user.collegeId === project.spokeId) {
      hasAccess = true;
    } else {
      const db = require('./db');
      const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [project.teamId]);
      const assignedTeam = teamRes.rows[0];
      if (assignedTeam && Array.isArray(assignedTeam.members) && assignedTeam.members.some(m => m === req.user.email || m.includes(req.user.name))) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden. You do not have permission to add Epics to this project." });
    }

    let jiraKey = null;
    const projectKey = project.jiraProjectKey || (project.spokeId === "kle-spoke" ? getJiraProject() : null);
    if (projectKey) {
      try {
        const adfDescription = description
          ? {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: description }]
                }
              ]
            }
          : undefined;

        const jiraRes = await axios.post(
          `${getJiraBase()}/rest/api/3/issue`,
          {
            fields: {
              project: { key: projectKey },
              summary: `[Epic] ${title}`,
              description: adfDescription,
              issuetype: { name: "Epic" }
            }
          },
          { auth: getJiraAuth(), headers: jiraHeaders }
        );
        jiraKey = jiraRes.data.key;
      } catch (jiraErr) {
        console.warn("Failed to create Epic in Jira, falling back to Task:", jiraErr.message);
        try {
          const jiraRes = await axios.post(
            `${getJiraBase()}/rest/api/3/issue`,
            {
              fields: {
                project: { key: projectKey },
                summary: `[Epic] ${title}`,
                description: description ? {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: description }] }]
                } : undefined,
                issuetype: { name: "Task" }
              }
            },
            { auth: getJiraAuth(), headers: jiraHeaders }
          );
          jiraKey = jiraRes.data.key;
        } catch (taskErr) {
          console.error("Failed to create Jira issue completely, using mock key:", taskErr.message);
          jiraKey = "MOCK-" + Math.floor(1000 + Math.random() * 9000);
        }
      }
    } else {
      jiraKey = "MOCK-" + Math.floor(1000 + Math.random() * 9000);
    }

    const newEpic = {
      id: "epic-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      title,
      description: description || "",
      jiraKey,
      status: "To Do"
    };

    if (!Array.isArray(project.epics)) {
      project.epics = [];
    }
    project.epics.push(newEpic);
    writeProjects(projects);
    res.json(newEpic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /projects/:id/assign-team ────────────────────────────────────────────
app.post("/projects/:id/assign-team", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { teamId } = req.body;

    const projects = readProjects();
    const projIdx = projects.findIndex(p => p.id === id);
    if (projIdx === -1) {
      return res.status(404).json({ error: "Project not found." });
    }

    const project = projects[projIdx];

    // Check permission
    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      if (req.user.role !== "College-SPOC" || req.user.collegeId !== project.spokeId) {
        return res.status(403).json({ error: "Forbidden. You do not have permission to assign teams for this Spoke." });
      }
    }

    const db = require('./db');
    const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    const team = teamRes.rows[0];
    if (!team) {
      return res.status(400).json({ error: "Invalid Team ID." });
    }

    project.teamId = teamId;

    // Send notification email log to each member of the team
    const emailSubject = `Project Assigned to Team: ${project.title}`;
    const emailBody = `Hi Team ${team.name},\n\n` +
      `The B2B project "${project.title}" has been assigned to your team.\n` +
      `Please review the Jira Epics and start working on tasks.\n\n` +
      `Best regards,\nSpoke Administrator`;

    const emailLog = await sendEmail({
      to: `team-${team.name.toLowerCase().replace(/\s+/g, '')}@college.edu`,
      subject: emailSubject,
      body: emailBody,
      type: "team_assignment"
    });

    if (!Array.isArray(project.reminders)) {
      project.reminders = [];
    }
    project.reminders.push(emailLog);

    writeProjects(projects);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /emails/simulate-meeting-email ──────────────────────────────────────
app.post("/emails/simulate-meeting-email", async (req, res) => {
  try {
    const { meeting } = req.body;
    if (!meeting) return res.status(400).json({ error: "Meeting details required" });

    const logs = [];
    if (meeting.participants && meeting.participants.length > 0) {
      for (const p of meeting.participants) {
        const emailAddress = `${p.toLowerCase().replace(/\s+/g, ".")}@apnileap.com`;
        const emailLog = await sendEmail({
          to: emailAddress,
          subject: `📅 DevCobra Meeting Invitation: ${meeting.title}`,
          body: `Hi ${p},\n\nYou have been invited to a DevCobra discussion.\n\nMeeting Title: ${meeting.title}\nHost: ${meeting.createdBy}\nTime: ${new Date(meeting.scheduledAt).toLocaleString()}\nMeeting ID: ${meeting.meetingId}\nAccess Code: ${meeting.accessCode}\n\nJoin link: http://localhost:3000/calls\n\nSecure meetings powered by DevCobra.`,
          type: "notification"
        });
        logs.push(emailLog);
      }
    }
    res.json({ message: "Simulated meeting emails sent", logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /emails/logs ─────────────────────────────────────────────────────────
app.get("/emails/logs", (req, res) => {
  try {
    const filePath = path.join(__dirname, "sent_emails.json");
    if (fs.existsSync(filePath)) {
      const logs = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return res.json(logs);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /emails/trigger-reminders ───────────────────────────────────────────
app.post("/emails/trigger-reminders", verifyToken, async (req, res) => {
  try {
    const projects = readProjects();
    const spokes = readSpokes();
    const triggered = [];

    for (let proj of projects) {
      if (!Array.isArray(proj.reminders)) {
        proj.reminders = [];
      }
      if (proj.status === "pending_review") {
        const email = await sendEmail({
          to: "moderator@apnileap.com",
          subject: `Reminder: Project ${proj.title} Awaiting Allocation`,
          body: `The B2B proposal "${proj.title}" from ${proj.company} is pending review. Please assign it to a Spoke.`,
          type: "reminder"
        });
        proj.reminders.push(email);
        triggered.push(email);
      } else if (proj.status === "allocated" && !proj.teamId) {
        const spoke = spokes.find(s => s.id === proj.spokeId);
        if (spoke) {
          const email = await sendEmail({
            to: spoke.spocEmail,
            subject: `Reminder: Project ${proj.title} Awaiting Team Assignment`,
            body: `Dear ${spoke.spocName},\n\nThe project "${proj.title}" is allocated to ${spoke.name} but has no team assigned. Please allocate a development team.`,
            type: "reminder"
          });
          proj.reminders.push(email);
          triggered.push(email);
        }
      }
    }

    writeProjects(projects);
    res.json({ message: `Triggered ${triggered.length} reminders.`, logs: triggered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mount PostgreSQL-based routers (Meetings, Submissions, Mock Tasks) ─────────
const meetingsRouter = require('./meetingsRouter');
const submissionsRouter = require('./submissionsRouter');
const mockTasksRouter = require('./mockTasksRouter');

app.use(meetingsRouter);
app.use(submissionsRouter);
app.use(mockTasksRouter);

// ── Mount APNILEAP Enterprise Routers (Realtime, Git, Audit, Rovo) ───────────
const realtime = require('./realtime');
const gitRouter = require('./gitRouter');
const auditRouter = require('./auditRouter').router;
const rovoRouter = require('./rovoRouter');

app.get('/api/realtime', realtime.handleRealtimeConnection);

// ── Call Signaling Routes (SSE Broadcast) ────────────────────────────────────
app.post("/api/v1/calls/initiate", verifyToken, (req, res) => {
  const { id, meetingId, accessCode, title, type, initiator, participants, teamId } = req.body;
  realtime.broadcast("CALL_INITIATED", { id, meetingId, accessCode, title, type, initiator, participants, teamId });
  res.json({ success: true });
});

app.post("/api/v1/calls/cancel", verifyToken, (req, res) => {
  const { meetingId } = req.body;
  realtime.broadcast("CALL_CANCELLED", { meetingId });
  res.json({ success: true });
});

app.post("/api/v1/calls/decline", verifyToken, (req, res) => {
  const { meetingId, participant } = req.body;
  realtime.broadcast("CALL_DECLINED", { meetingId, participant });
  res.json({ success: true });
});

// ── Call Store Persistence Routes (PostgreSQL-based) ─────────────────────────
app.get("/api/v1/calls/store", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const result = await db.query('SELECT data FROM calls_store WHERE id = 1');
    if (result.rows.length > 0) {
      return res.json(result.rows[0].data);
    }
    res.json({ meetings: [], callLogs: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v1/calls/store", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { meetings, callLogs } = req.body;
    const storeData = { meetings: meetings || [], callLogs: callLogs || [] };
    
    await db.query(
      `INSERT INTO calls_store (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(storeData)]
    );
    
    realtime.broadcast("CALLS_STORE_UPDATED", storeData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(gitRouter);
app.use(auditRouter);
app.use(rovoRouter);

// ── Serve React build (production / single-server mode) ───────────────────────
// When 'npm run build' is run from the root, the React app is built into
// frontend/frontend/build and Express serves it alongside the API.
const buildPath = path.join(__dirname, "..", "frontend", "frontend", "build");
console.log(`[Diagnostic] checking buildPath: ${buildPath}`);
console.log(`[Diagnostic] buildPath exists: ${fs.existsSync(buildPath)}`);

if (!fs.existsSync(buildPath)) {
  const parentDir = path.join(__dirname, "..", "frontend", "frontend");
  console.log(`[Diagnostic] parentDir exists: ${fs.existsSync(parentDir)}`);
  if (fs.existsSync(parentDir)) {
    try {
      console.log(`[Diagnostic] parentDir contents: ${fs.readdirSync(parentDir).join(', ')}`);
    } catch (e) {
      console.log(`[Diagnostic] failed to read parentDir: ${e.message}`);
    }
  }
}

if (fs.existsSync(buildPath)) {
  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(buildPath));

  // Catch-all route — must come AFTER all API routes
  app.get("/*path", (req, res) => {
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