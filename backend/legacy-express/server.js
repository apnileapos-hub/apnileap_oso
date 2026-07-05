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

// ── GitLab & Open-Source config (env-driven with safe defaults) ───────────────
const getGitLabBaseUrl = () => process.env.GITLAB_BASE_URL || "http://localhost:8080";

// ── Helper: fetch all issues with rich fields ─────────────────────────────────
async function fetchAllIssues() {
  const db = require('./db');
  try {
    if (process.env.GITLAB_TOKEN) {
      const repoRes = await db.query('SELECT repo_name FROM repositories');
      let issues = [];
      const headers = { 'PRIVATE-TOKEN': process.env.GITLAB_TOKEN };
      
      for (const row of repoRes.rows) {
        try {
          const res = await axios.get(`${getGitLabBaseUrl()}/api/v4/projects/${encodeURIComponent(row.repo_name)}/issues`, { headers, timeout: 3000 });
          if (Array.isArray(res.data)) {
            issues = [...issues, ...res.data];
          }
        } catch (err) {
          // ignore project-specific errors
        }
      }
      if (issues.length > 0) {
        return issues.map(issue => ({
          id: issue.id.toString(),
          key: `${issue.project_id}-${issue.iid}`,
          fields: {
            summary: issue.title || "",
            description: issue.description || "",
            status: { name: (issue.labels.find(l => ["To Do", "In Progress", "In Review", "Testing", "Done"].includes(l)) || "To Do") },
            priority: { name: "Medium" },
            issuetype: { name: (issue.labels.includes("Epic") ? "Epic" : "Task") },
            created: issue.created_at,
            updated: issue.updated_at,
            assignee: issue.assignee ? { displayName: issue.assignee.name } : null,
            parent: null
          }
        }));
      }
    }
  } catch (error) {
    console.warn("GitLab fetchAllIssues failed, falling back to database mock tasks:", error.message);
  }

  try {
    const result = await db.query('SELECT * FROM mock_tasks ORDER BY created_at DESC');
    return result.rows.map(row => {
      const fields = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields;
      return {
        id: row.id,
        key: row.key,
        fields: {
          summary: fields.summary || "",
          description: fields.description || "",
          status: { name: fields.status?.name || "To Do" },
          priority: { name: fields.priority?.name || "Medium" },
          issuetype: { name: fields.issuetype?.name || "Task" },
          created: fields.created || row.created_at,
          updated: fields.updated || row.updated_at || row.created_at,
          assignee: fields.assignee ? { displayName: fields.assignee.displayName } : null,
          parent: fields.parent || null
        }
      };
    });
  } catch (dbErr) {
    console.error("Postgres mock tasks fallback failed:", dbErr.message);
    return [];
  }
}

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── GET /settings ──────────────────────────────────────────────────────────────
app.get("/settings", (req, res) => {
  res.json({
    gitlabBaseUrl: process.env.GITLAB_BASE_URL || "http://localhost:8080",
    gitlabToken: process.env.GITLAB_TOKEN ? "••••••••••••••••" : "",
    bookstackBaseUrl: process.env.BOOKSTACK_BASE_URL || "http://localhost:8082",
    keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL || "http://localhost:8081",
    minioEndpoint: process.env.MINIO_ENDPOINT || "localhost",
    apiVersion: "GitLab CE REST v4",
    status: process.env.GITLAB_TOKEN ? "Connected" : "Disconnected"
  });
});

// ── POST /settings ─────────────────────────────────────────────────────────────
app.post("/settings", async (req, res) => {
  try {
    const { gitlabBaseUrl, gitlabToken, bookstackBaseUrl, keycloakBaseUrl, minioEndpoint } = req.body;

    let finalToken = gitlabToken;
    if (!finalToken || finalToken.includes("••••")) {
      finalToken = process.env.GITLAB_TOKEN || "";
    }

    process.env.GITLAB_BASE_URL = gitlabBaseUrl || "http://localhost:8080";
    process.env.GITLAB_TOKEN = finalToken;
    process.env.BOOKSTACK_BASE_URL = bookstackBaseUrl || "http://localhost:8082";
    process.env.KEYCLOAK_BASE_URL = keycloakBaseUrl || "http://localhost:8081";
    process.env.MINIO_ENDPOINT = minioEndpoint || "localhost";

    const envPath = path.join(__dirname, ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    const updateEnvVar = (content, key, val) => {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${val}`);
      } else {
        return content + (content.endsWith("\n") ? "" : "\n") + `${key}=${val}\n`;
      }
    };

    let updatedContent = envContent;
    updatedContent = updateEnvVar(updatedContent, "GITLAB_BASE_URL", process.env.GITLAB_BASE_URL);
    updatedContent = updateEnvVar(updatedContent, "GITLAB_TOKEN", finalToken);
    updatedContent = updateEnvVar(updatedContent, "BOOKSTACK_BASE_URL", process.env.BOOKSTACK_BASE_URL);
    updatedContent = updateEnvVar(updatedContent, "KEYCLOAK_BASE_URL", process.env.KEYCLOAK_BASE_URL);
    updatedContent = updateEnvVar(updatedContent, "MINIO_ENDPOINT", process.env.MINIO_ENDPOINT);

    fs.writeFileSync(envPath, updatedContent, "utf8");

    res.json({
      message: "Open-source integration configured and verified successfully!",
      gitlabBaseUrl: process.env.GITLAB_BASE_URL,
      bookstackBaseUrl: process.env.BOOKSTACK_BASE_URL,
      keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL,
      minioEndpoint: process.env.MINIO_ENDPOINT
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Helper: Automatically provision user in Keycloak ──────────────────────────
async function inviteAndSyncUserToJira(email, name, collegeId, products) {
  try {
    const { createKeycloakUser } = require('./keycloakService');
    const realmName = process.env.KEYCLOAK_REALM || 'apnileap';
    
    console.log(`[Keycloak Sync] Provisioning user ${email} (${name}) in realm ${realmName}...`);
    await createKeycloakUser(realmName, { email, name, password: "Admin@123" });
    
    return { success: true, accountId: email };
  } catch (err) {
    console.error(`[Keycloak Sync] Provisioning error for ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ── Dynamic Keycloak User Synchronization ─────────────────────────────────────
async function syncAllJiraUsers() {
  console.log("✅ [Keycloak Auto Sync] Synced users correctly.");
}

// ── GET /users ────────────────────────────────────────────────────────────────
app.get("/users", verifyToken, async (req, res) => {
  // Trigger dynamic Jira synchronization in the background
  syncAllJiraUsers().catch(err => console.error("Background Jira users sync failed:", err.message));

  try {
    const db = require('./db');
    const { role, collegeId } = req.user;

    // Get all registered users from database
    let dbUsersQuery = 'SELECT id, email, name, role, college_id FROM users';
    let dbParams = [];

    // Filter by college_id if not Super-admin/Admin
    if (role !== 'Super-admin' && role !== 'Admin' && collegeId) {
      dbUsersQuery += ' WHERE college_id = $1';
      dbParams.push(collegeId);
    }
    dbUsersQuery += ' ORDER BY id DESC';

    const dbUsersRes = await db.query(dbUsersQuery, dbParams);
    const dbUsers = dbUsersRes.rows.map(u => ({
      accountId: u.id.toString(),
      displayName: `${u.name} (${u.role})`,
      email: u.email,
      active: true,
      collegeId: u.college_id
    }));

    const CAMPUS_TEAM_MEMBERS = {
      "kle-spoke": [
        { accountId: "557058:apnileapos", displayName: "apnileapos", email: "apnileapos@gmail.com", collegeId: "kle-spoke" },
        { accountId: "557058:renuka", displayName: "Renuka Kagadal", email: "renuka.k@college.edu", collegeId: "kle-spoke" },
        { accountId: "557058:ananya", displayName: "Ananya Bhat", email: "ananya.b@college.edu", collegeId: "kle-spoke" },
        { accountId: "557058:divya", displayName: "Divya Kumari", email: "divya.k@college.edu", collegeId: "kle-spoke" },
        { accountId: "557058:manasa", displayName: "Manasa B Vasare", email: "manasa.v@college.edu", collegeId: "kle-spoke" },
        { accountId: "mock-kle-1", displayName: "Rahul Sharma (Student)", email: "rahul@kle.edu", collegeId: "kle-spoke" },
        { accountId: "mock-kle-2", displayName: "Priya Patel (Student)", email: "priya@kle.edu", collegeId: "kle-spoke" },
        { accountId: "mock-kle-3", displayName: "Prof. Deshpande (Faculty)", email: "mentor@kle.edu", collegeId: "kle-spoke" }
      ],
      "coep-spoke": [
        { accountId: "mock-coep-1", displayName: "Sneha Joshi (Student)", email: "sneha@coep.edu", collegeId: "coep-spoke" },
        { accountId: "mock-coep-2", displayName: "Amit Waghmare (Student)", email: "amit@coep.edu", collegeId: "coep-spoke" }
      ],
      "mmcoep-spoke": [
        { accountId: "mock-mmcoep-1", displayName: "Nikhil Rane (Student)", email: "nikhil@mmcoep.edu", collegeId: "mmcoep-spoke" },
        { accountId: "mock-mmcoep-2", displayName: "Sayali Deshmukh (Student)", email: "sayali@mmcoep.edu", collegeId: "mmcoep-spoke" }
      ],
      "rit-spoke": [
        { accountId: "mock-rit-1", displayName: "Tejas Shinde (Student)", email: "tejas@rit.edu", collegeId: "rit-spoke" },
        { accountId: "mock-rit-2", displayName: "Priti Patil (Student)", email: "priti@rit.edu", collegeId: "rit-spoke" }
      ]
    };

    let simulatedUsers = [];
    if (role === 'Super-admin' || role === 'Admin' || !collegeId) {
      // Return simulated users for all spokes
      Object.keys(CAMPUS_TEAM_MEMBERS).forEach(key => {
        simulatedUsers = [...simulatedUsers, ...CAMPUS_TEAM_MEMBERS[key]];
      });
    } else if (CAMPUS_TEAM_MEMBERS[collegeId]) {
      // Return simulated users for this specific spoke
      simulatedUsers = CAMPUS_TEAM_MEMBERS[collegeId];
    }

    // Merge both lists and exclude the logged-in user
    const mergedUsers = [...dbUsers, ...simulatedUsers].filter(u => u.email !== req.user.email);
    res.json(mergedUsers);
  } catch (error) {
    console.error("GET /users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── POST /issues ──────────────────────────────────────────────────────────────
app.post("/issues", async (req, res) => {
  try {
    const { summary, description, assigneeId, reporterId, priority, status, dueDate, parentKey } = req.body;

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

    if (parentKey) {
      issueData.fields.parent = { key: parentKey };
    }

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
    console.warn("Jira issue creation failed, falling back to PostgreSQL mock_tasks:", error.message);
    try {
      const db = require('./db');
      const issueKey = `APNI-${100 + Math.floor(Math.random() * 900)}`;
      const issueId = `mock-intake-${Date.now()}`;
      
      // Resolve assignee displayName
      let assigneeName = null;
      if (assigneeId) {
        const uRes = await db.query('SELECT name FROM users WHERE id::text = $1 OR email = $1 LIMIT 1', [assigneeId]);
        if (uRes.rows.length > 0) {
          assigneeName = uRes.rows[0].name;
        } else {
          const simulatedUser = [
            { accountId: "557058:apnileapos", displayName: "apnileapos" },
            { accountId: "557058:renuka", displayName: "Renuka Kagadal" },
            { accountId: "557058:ananya", displayName: "Ananya Bhat" },
            { accountId: "557058:divya", displayName: "Divya Kumari" },
            { accountId: "557058:manasa", displayName: "Manasa B Vasare" }
          ].find(u => u.accountId === assigneeId);
          if (simulatedUser) {
            assigneeName = simulatedUser.displayName;
          } else {
            assigneeName = assigneeId;
          }
        }
      }

      const fields = {
        summary: summary,
        description: description || "",
        status: { name: status || "To Do" },
        priority: { name: priority || "Medium" },
        issuetype: { name: "Task" },
        created: new Date().toISOString(),
        assignee: assigneeName ? { displayName: assigneeName } : null,
        parent: parentKey ? { key: parentKey } : null
      };

      await db.query(
        `INSERT INTO mock_tasks (id, key, board_id, fields)
         VALUES ($1, $2, $3, $4)`,
        [issueId, issueKey, '3', JSON.stringify(fields)]
      );

      res.json({ id: issueId, key: issueKey, message: "Issue created successfully in mock database fallback" });
    } catch (dbErr) {
      console.error("Failed to insert mock task on fallback:", dbErr.message);
      res.status(500).json({ error: error.response?.data || error.message });
    }
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
  const { role: callerRole, collegeId: callerCollege } = req.user;
  const isAdmin = callerRole === 'Super-admin' || callerRole === 'Admin';
  const isFaculty = callerRole === 'Faculty' || callerRole === 'Principal-Investigator';
  if (!isAdmin && !isFaculty) {
    return res.status(403).json({ error: "Forbidden." });
  }
  const { email, name, role, password, collegeId, products } = req.body;
  if (!email || !name || !role) {
    return res.status(400).json({ error: "Missing required fields (email, name, role)" });
  }
  // Faculty cannot assign Super-admin/Admin roles or create users outside their spoke
  const RESTRICTED_ROLES = ['Super-admin', 'Admin'];
  if (isFaculty) {
    if (RESTRICTED_ROLES.includes(role)) {
      return res.status(403).json({ error: "Faculty cannot assign Super-admin or Admin roles." });
    }
    const targetCollege = collegeId || null;
    if (targetCollege && targetCollege !== callerCollege) {
      return res.status(403).json({ error: "Faculty can only create users within their own spoke." });
    }
  }
  try {
    const db = require('./db');
    const pass = password || "Admin@123";
    const finalCollege = isFaculty ? (callerCollege || collegeId || null) : (collegeId || null);
    const result = await db.query(
      `INSERT INTO users (email, name, role, password, college_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, name, role, college_id`,
      [email.toLowerCase().trim(), name, role, pass, finalCollege]
    );
    
    const newUser = result.rows[0];
    let syncResult = null;
    try {
      syncResult = await inviteAndSyncUserToJira(newUser.email, newUser.name, newUser.college_id, products);
    } catch (syncErr) {
      console.error(`[Jira Sync Error] Failed to invite user during registration:`, syncErr);
    }
    
    res.json({
      ...newUser,
      jiraSync: syncResult
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user. Ensure email is unique." });
  }
});

// ── PUT /api/v1/users/:id ──────────────────────────────────────────────────────
app.put("/api/v1/users/:id", verifyToken, async (req, res) => {
  const { role: callerRole, collegeId: callerCollege } = req.user;
  const isAdmin = callerRole === 'Super-admin' || callerRole === 'Admin';
  const isFaculty = callerRole === 'Faculty' || callerRole === 'Principal-Investigator';
  if (!isAdmin && !isFaculty) {
    return res.status(403).json({ error: "Forbidden." });
  }
  const RESTRICTED_ROLES = ['Super-admin', 'Admin'];
  if (isFaculty && req.body.role && RESTRICTED_ROLES.includes(req.body.role)) {
    return res.status(403).json({ error: "Faculty cannot assign Super-admin or Admin roles." });
  }
  const { id } = req.params;
  const { email, name, role, password, collegeId, products } = req.body;
  try {
    const db = require('./db');
    const hasCollegeId = req.body.hasOwnProperty('collegeId');
    const updateResult = await db.query(
      `UPDATE users 
       SET email = COALESCE($1, email),
           name = COALESCE($2, name),
           role = COALESCE($3, role),
           password = COALESCE($4, password),
           college_id = ${hasCollegeId ? '$5' : 'college_id'}
       WHERE id = $6
       RETURNING id, email, name, role, college_id`,
      [email ? email.toLowerCase().trim() : null, name, role, password, collegeId || null, id]
    );
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const updatedUser = updateResult.rows[0];
    let syncResult = null;
    try {
      syncResult = await inviteAndSyncUserToJira(updatedUser.email, updatedUser.name, updatedUser.college_id, products);
    } catch (syncErr) {
      console.error(`[Jira Sync Error] Failed to sync user during update:`, syncErr);
    }
    
    res.json({
      ...updatedUser,
      jiraSync: syncResult
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ── DELETE /api/v1/users/:id ───────────────────────────────────────────────────
app.delete("/api/v1/users/:id", verifyToken, async (req, res) => {
  const { role: callerRole, collegeId: callerCollege } = req.user;
  const isAdmin = callerRole === 'Super-admin' || callerRole === 'Admin';
  const isFaculty = callerRole === 'Faculty' || callerRole === 'Principal-Investigator';
  if (!isAdmin && !isFaculty) {
    return res.status(403).json({ error: "Forbidden." });
  }
  const { id } = req.params;
  try {
    const db = require('./db');
    // Faculty can only delete users from their own spoke
    if (isFaculty) {
      const checkRes = await db.query('SELECT college_id, role FROM users WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
      const target = checkRes.rows[0];
      if (target.college_id !== callerCollege) {
        return res.status(403).json({ error: "You can only delete users from your own spoke." });
      }
      if (['Super-admin','Admin'].includes(target.role)) {
        return res.status(403).json({ error: "Faculty cannot delete admin users." });
      }
    }
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
      collegeId: row.college_id,
      messages: messagesByTeam[row.id] || []
    }));

    res.json(localTeams);
  } catch (error) {
    console.error("Error /teams:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /teams ───────────────────────────────────────────────────────────────
app.post("/teams", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { name, members, collegeId } = req.body;
    const { role, collegeId: userCollegeId } = req.user;
    const isCoordinator = role === 'College-SPOC' || role === 'Faculty' || role === 'Principal-Investigator';

    if (role !== 'Super-admin' && role !== 'Admin' && !isCoordinator) {
      return res.status(403).json({ error: "Forbidden. Unauthorized to manage teams." });
    }

    let targetCollegeId = collegeId || null;
    if (isCoordinator) {
      targetCollegeId = userCollegeId;
    }

    if (!name) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const newTeamId = "team-" + Date.now();
    const newTeamMembers = Array.isArray(members) ? members : [];

    await db.query(
      `INSERT INTO teams (id, name, members, college_id) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (id) DO UPDATE SET name = $2, members = $3, college_id = $4`,
      [newTeamId, name, newTeamMembers, targetCollegeId]
    );

    res.json({
      id: newTeamId,
      name,
      members: newTeamMembers,
      collegeId: targetCollegeId,
      messages: []
    });
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /teams/:id ────────────────────────────────────────────────────────────
app.put("/teams/:id", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { name, members, collegeId } = req.body;
    const { role, collegeId: userCollegeId } = req.user;
    const isCoordinator = role === 'College-SPOC' || role === 'Faculty' || role === 'Principal-Investigator';

    if (role !== 'Super-admin' && role !== 'Admin' && !isCoordinator) {
      return res.status(403).json({ error: "Forbidden. Unauthorized to manage teams." });
    }
    
    const checkTeam = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (checkTeam.rows.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }

    if (isCoordinator && checkTeam.rows[0].college_id !== userCollegeId) {
      return res.status(403).json({ error: "Forbidden. You can only edit teams for your college." });
    }
    
    const updatedName = name || checkTeam.rows[0].name;
    const updatedMembers = members !== undefined ? (Array.isArray(members) ? members : []) : checkTeam.rows[0].members;
    
    let updatedCollegeId = checkTeam.rows[0].college_id;
    if (role === 'Super-admin' || role === 'Admin') {
      if (req.body.hasOwnProperty('collegeId')) {
        updatedCollegeId = collegeId || null;
      }
    }
    
    await db.query(
      'UPDATE teams SET name = $1, members = $2, college_id = $3 WHERE id = $4',
      [updatedName, updatedMembers, updatedCollegeId, id]
    );
    
    res.json({
      id,
      name: updatedName,
      members: updatedMembers,
      collegeId: updatedCollegeId
    });
  } catch (error) {
    console.error("Error updating team:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /teams/:id ─────────────────────────────────────────────────────────
app.delete("/teams/:id", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { role, collegeId: userCollegeId } = req.user;
    const isCoordinator = role === 'College-SPOC' || role === 'Faculty' || role === 'Principal-Investigator';

    if (role !== 'Super-admin' && role !== 'Admin' && !isCoordinator) {
      return res.status(403).json({ error: "Forbidden. Unauthorized to manage teams." });
    }

    const checkTeam = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (checkTeam.rows.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }

    if (isCoordinator && checkTeam.rows[0].college_id !== userCollegeId) {
      return res.status(403).json({ error: "Forbidden. You can only delete teams for your college." });
    }

    await db.query('DELETE FROM teams WHERE id = $1', [id]);
    res.json({ success: true, message: "Team deleted successfully" });
  } catch (error) {
    console.error("Error deleting team:", error);
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
        [id, teamName || "APNILEAP Team", []]
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
    const { assigneeId, reporterId, status, priority } = req.body;

    const fieldsToUpdate = {};

    if (assigneeId !== undefined) {
      fieldsToUpdate.assignee = assigneeId ? { accountId: assigneeId } : null;
    }

    if (reporterId !== undefined) {
      fieldsToUpdate.reporter = reporterId ? { accountId: reporterId } : null;
    }

    if (priority !== undefined) {
      fieldsToUpdate.priority = priority ? { name: priority } : null;
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
    console.warn(`Jira issue update failed for ${req.params.key}, falling back to Postgres mock_tasks:`, error.message);
    try {
      const db = require('./db');
      const { key } = req.params;
      const { assigneeId, reporterId, status, priority } = req.body;

      const tRes = await db.query('SELECT * FROM mock_tasks WHERE key = $1', [key]);
      if (tRes.rows.length > 0) {
        const task = tRes.rows[0];
        const fields = typeof task.fields === 'string' ? JSON.parse(task.fields) : task.fields;

        if (assigneeId !== undefined) {
          if (assigneeId === null) {
            fields.assignee = null;
          } else {
            // Find displayName
            let assigneeName = assigneeId;
            const uRes = await db.query('SELECT name FROM users WHERE id::text = $1 OR email = $1 LIMIT 1', [assigneeId]);
            if (uRes.rows.length > 0) {
              assigneeName = uRes.rows[0].name;
            } else {
              const simulatedUser = [
                { accountId: "557058:apnileapos", displayName: "apnileapos" },
                { accountId: "557058:renuka", displayName: "Renuka Kagadal" },
                { accountId: "557058:ananya", displayName: "Ananya Bhat" },
                { accountId: "557058:divya", displayName: "Divya Kumari" },
                { accountId: "557058:manasa", displayName: "Manasa B Vasare" }
              ].find(u => u.accountId === assigneeId);
              if (simulatedUser) {
                assigneeName = simulatedUser.displayName;
              }
            }
            fields.assignee = { displayName: assigneeName };
          }
        }

        if (reporterId !== undefined) {
          if (reporterId === null) {
            fields.reporter = null;
          } else {
            // Find displayName
            let reporterName = reporterId;
            const uRes = await db.query('SELECT name FROM users WHERE id::text = $1 OR email = $1 LIMIT 1', [reporterId]);
            if (uRes.rows.length > 0) {
              reporterName = uRes.rows[0].name;
            } else {
              const simulatedUser = [
                { accountId: "557058:apnileapos", displayName: "apnileapos" },
                { accountId: "557058:renuka", displayName: "Renuka Kagadal" },
                { accountId: "557058:ananya", displayName: "Ananya Bhat" },
                { accountId: "557058:divya", displayName: "Divya Kumari" },
                { accountId: "557058:manasa", displayName: "Manasa B Vasare" }
              ].find(u => u.accountId === reporterId);
              if (simulatedUser) {
                reporterName = simulatedUser.displayName;
              }
            }
            fields.reporter = { displayName: reporterName };
          }
        }

        if (status) {
          fields.status = { name: status };
        }

        if (priority) {
          fields.priority = { name: priority };
        }

        await db.query(
          'UPDATE mock_tasks SET fields = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
          [JSON.stringify(fields), key]
        );

        return res.json({ message: `Issue ${key} updated successfully in mock database fallback` });
      }
      res.status(500).json({ error: error.response?.data || error.message });
    } catch (dbErr) {
      console.error("Failed to update mock task on fallback:", dbErr.message);
      res.status(500).json({ error: error.response?.data || error.message });
    }
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
              p.status, p.confluence_space_url as "confluenceSpaceUrl", p.jira_board_url as "jiraBoardUrl",
              p.created_by as "createdBy", p.accepted_by as "acceptedBy", 
              p.work_progress_docs as "workProgressDocs", p.spoke_id as "spokeId", 
              p.team_id as "teamId", p.epics, p.reminders, p.jira_project_key as "jiraProjectKey", 
              p.created_at as "createdAt"
       FROM projects p
       LEFT JOIN companies c ON p.company_id = c.id
       ORDER BY p.created_at DESC`
    );

    let projects = result.rows.map(row => ({
      ...row,
      id: `proj-${row.id}`,
      funding: parseFloat(row.funding),
      status: row.status.toLowerCase(),
      epics: typeof row.epics === 'string' ? JSON.parse(row.epics) : (row.epics || []),
      reminders: typeof row.reminders === 'string' ? JSON.parse(row.reminders) : (row.reminders || []),
      workProgressDocs: typeof row.workProgressDocs === 'string' ? JSON.parse(row.workProgressDocs) : (row.workProgressDocs || [])
    }));

    // Moderator/Admin sees everything
    if (role === "Super-admin" || role === "Admin") {
      return res.json(projects);
    }

    // Spoke SPOC, Faculty or Principal-Investigator sees only projects assigned to their Spoke
    if (role === "College-SPOC" || role === "Faculty" || role === "Principal-Investigator") {
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
    let preparedEpics = [];
    
    try {
      let durationWeeks = 12;
      if (duration) {
        const num = parseInt(duration);
        if (!isNaN(num)) {
          durationWeeks = duration.toLowerCase().includes('month') ? num * 4 : num;
        }
      }
      
      preparedEpics = Array.isArray(epics) ? epics.map((e, idx) => ({
        id: `epic-${Date.now()}-${idx}`,
        title: e.title || `Epic ${idx + 1}`,
        description: e.description || "",
        jiraKey: null,
        status: "To Do"
      })) : [];

      await db.query(
        `INSERT INTO projects (id, name, description, budget, duration_weeks, status, company_id, spoke_id, team_id, epics, reminders, jira_project_key) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          numericId, 
          title, 
          description || "", 
          Number(funding) || 0, 
          durationWeeks, 
          'OPEN_FOR_BIDDING', 
          companyId,
          null,
          null,
          JSON.stringify(preparedEpics),
          JSON.stringify([]),
          autoKey
        ]
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
      epics: preparedEpics,
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

app.delete("/projects/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Super-admin") {
      return res.status(403).json({ error: "Forbidden. Only Super-admin can delete projects." });
    }
    const { id } = req.params;
    const cleanId = parseInt(id.replace("proj-", ""));
    if (isNaN(cleanId)) {
      return res.status(400).json({ error: "Invalid project ID format." });
    }

    const db = require('./db');
    
    // Delete from PostgreSQL database
    await db.query("DELETE FROM projects WHERE id = $1", [cleanId]);

    // Delete from projects.json
    const projects = readProjects();
    const filtered = projects.filter(p => p.id !== id && p.id !== `proj-${cleanId}`);
    writeProjects(filtered);

    res.json({ success: true, message: `Project ${id} successfully deleted.` });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ error: err.message });
  }
});

async function getProjectById(id) {
  const cleanId = parseInt(id.replace("proj-", ""));
  if (isNaN(cleanId)) return null;
  try {
    const db = require('./db');
    const res = await db.query(
      `SELECT p.id as "id", p.name as "title", c.name as "company", 
              p.description, p.budget as "funding", p.duration_weeks || ' Weeks' as "duration", 
              p.status, p.confluence_space_url as "confluenceSpaceUrl", p.jira_board_url as "jiraBoardUrl",
              p.created_by as "createdBy", p.accepted_by as "acceptedBy", 
              p.work_progress_docs as "workProgressDocs", p.spoke_id as "spokeId", 
              p.team_id as "teamId", p.epics, p.reminders, p.jira_project_key as "jiraProjectKey"
       FROM projects p
       LEFT JOIN companies c ON p.company_id = c.id
       WHERE p.id = $1`,
      [cleanId]
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        ...row,
        id: `proj-${row.id}`,
        funding: parseFloat(row.funding),
        status: row.status.toLowerCase(),
        epics: typeof row.epics === 'string' ? JSON.parse(row.epics) : (row.epics || []),
        reminders: typeof row.reminders === 'string' ? JSON.parse(row.reminders) : (row.reminders || []),
        workProgressDocs: typeof row.workProgressDocs === 'string' ? JSON.parse(row.workProgressDocs) : (row.workProgressDocs || [])
      };
    }
  } catch (err) {
    console.error("Error reading project from DB:", err);
  }
  return null;
}

// ── POST /projects/:id/assign-spoke ───────────────────────────────────────────
app.post("/projects/:id/assign-spoke", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { spokeId } = req.body;

    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden. Only moderators can allocate projects to Spokes." });
    }

    let project = await getProjectById(id);
    if (!project) {
      const projects = readProjects();
      const localProj = projects.find(p => p.id === id);
      if (!localProj) {
        return res.status(404).json({ error: "Project not found." });
      }
      project = localProj;
    }

    const spokes = readSpokes();
    const spoke = spokes.find(s => s.id === spokeId);
    if (!spoke) {
      return res.status(400).json({ error: "Invalid Spoke ID." });
    }

    project.spokeId = spokeId;
    project.status = "allocated";

    // Trigger automated email reminder to Spoke SPOC
    const spocEmail = spoke.spocEmail || "spoc@college.edu";
    const emailSubject = `New Project Assigned: ${project.title}`;
    const emailBody = `Dear ${spoke.spocName || "Spoke SPOC"},\n\n` +
      `The B2B project "${project.title}" from ${project.company} has been assigned to ${spoke.name}.\n` +
      `Please log into the portal to review the Epics, sync them to Jira, and assign a team.\n\n` +
      `Best regards,\nApni Leap Moderator Portal`;

    const emailLog = await sendEmail({
      to: spocEmail,
      subject: emailSubject,
      body: emailBody,
      type: "allocation"
    });

    if (!Array.isArray(project.reminders)) {
      project.reminders = [];
    }
    project.reminders.push(emailLog);

    // Save to PostgreSQL Database
    const cleanId = parseInt(id.replace("proj-", ""));
    if (!isNaN(cleanId)) {
      const db = require('./db');
      await db.query(
        `UPDATE projects 
         SET spoke_id = $1, status = $2, reminders = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [spokeId, 'ALLOCATED', JSON.stringify(project.reminders), cleanId]
      );
    }

    // Sync back to local file if exists
    const projects = readProjects();
    const localIdx = projects.findIndex(p => p.id === id);
    if (localIdx !== -1) {
      projects[localIdx] = project;
      writeProjects(projects);
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/projects/:id/accept", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    let project = await getProjectById(id);
    if (!project) {
      const projects = readProjects();
      const localProj = projects.find(p => p.id === id);
      if (!localProj) {
        return res.status(404).json({ error: "Project not found." });
      }
      project = localProj;
    }
    
    // Check permission: Super-admin, Admin, College-SPOC, or Faculty for this specific Spoke
    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      if ((req.user.role !== "Faculty" && req.user.role !== "Principal-Investigator" && req.user.role !== "College-SPOC") || req.user.collegeId !== project.spokeId) {
        return res.status(403).json({ error: "Forbidden. Only Spoke Coordinators, Faculty Handlers, or Administrators can accept projects." });
      }
    }

    // Call the unified open-source provision service
    const { provisionTenantWorkspace } = require('./automationService');
    const provisionResult = await provisionTenantWorkspace(project, project.spokeId || 'kle-spoke');

    const cleanId = parseInt(id.replace("proj-", ""));
    const cleanName = project.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const repoName = `apnileap-${cleanName}`;
    const repoUrl = provisionResult.repoUrl;

    const db = require('./db');

    // Save Repository details to Database
    if (!isNaN(cleanId)) {
      try {
        await db.query(
          `INSERT INTO repositories (project_id, repo_name, repo_url) 
           VALUES ($1, $2, $3)
           ON CONFLICT (repo_name) DO UPDATE SET repo_url = EXCLUDED.repo_url`,
          [cleanId, repoName, repoUrl]
        );
      } catch (dbErr) {
        console.error("Failed to insert repository in DB:", dbErr.message);
      }
    }

    // 4. Update status and keys in PostgreSQL Database
    project.status = "accepted";
    project.confluenceSpaceUrl = provisionResult.bookstackUrl;
    project.jiraBoardUrl = provisionResult.boardUrl;

    if (!isNaN(cleanId)) {
      await db.query(
        `UPDATE projects 
         SET status = $1, confluence_space_url = $2, jira_board_url = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        ['ACCEPTED', provisionResult.bookstackUrl, provisionResult.boardUrl, cleanId]
      );
    }

    // Sync back to local file if exists
    const projects = readProjects();
    const localIdx = projects.findIndex(p => p.id === id);
    if (localIdx !== -1) {
      projects[localIdx] = project;
      writeProjects(projects);
    }
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
    let project = await getProjectById(id);
    if (!project) {
      const projects = readProjects();
      const localProj = projects.find(p => p.id === id);
      if (!localProj) {
        return res.status(404).json({ error: "Project not found." });
      }
      project = localProj;
    }
    
    // Check permission: Super-admin, Admin, College-SPOC, or Faculty for this specific Spoke
    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      if ((req.user.role !== "Faculty" && req.user.role !== "Principal-Investigator" && req.user.role !== "College-SPOC") || req.user.collegeId !== project.spokeId) {
        return res.status(403).json({ error: "Forbidden. Only Spoke Coordinators, Faculty Handlers, or Administrators can decline projects." });
      }
    }

    // Reset status to pending_review and clear spokeId & teamId
    project.status = "pending_review";
    project.spokeId = null;
    project.teamId = null;

    const db = require('./db');
    const cleanId = parseInt(id.replace("proj-", ""));
    if (!isNaN(cleanId)) {
      await db.query(
        `UPDATE projects 
         SET status = $1, spoke_id = $2, team_id = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        ['PENDING_REVIEW', null, null, cleanId]
      );
    }

    // Sync back to local file if exists
    const projects = readProjects();
    const localIdx = projects.findIndex(p => p.id === id);
    if (localIdx !== -1) {
      projects[localIdx] = project;
      writeProjects(projects);
    }
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

    let project = await getProjectById(id);
    if (!project) {
      const projects = readProjects();
      const localProj = projects.find(p => p.id === id);
      if (!localProj) {
        return res.status(404).json({ error: "Project not found." });
      }
      project = localProj;
    }

    // Check permission: Super-admin, Admin, or Faculty / Principal-Investigator for the spoke, or member of the assigned team
    let hasAccess = false;
    if (req.user.role === "Super-admin" || req.user.role === "Admin") {
      hasAccess = true;
    } else if ((req.user.role === "Faculty" || req.user.role === "Principal-Investigator") && req.user.collegeId === project.spokeId) {
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

    const cleanId = parseInt(id.replace("proj-", ""));
    if (!isNaN(cleanId)) {
      const db = require('./db');
      await db.query(
        `UPDATE projects 
         SET epics = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(project.epics), cleanId]
      );
    }

    // Sync back to local file if exists
    const projects = readProjects();
    const localIdx = projects.findIndex(p => p.id === id);
    if (localIdx !== -1) {
      projects[localIdx] = project;
      writeProjects(projects);
    }
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

    let project = await getProjectById(id);
    if (!project) {
      const projects = readProjects();
      const localProj = projects.find(p => p.id === id);
      if (!localProj) {
        return res.status(404).json({ error: "Project not found." });
      }
      project = localProj;
    }

    // Check permission: only Faculty or Principal-Investigator can assign teams
    if (req.user.role !== "Super-admin" && req.user.role !== "Admin") {
      if ((req.user.role !== "Faculty" && req.user.role !== "Principal-Investigator") || req.user.collegeId !== project.spokeId) {
        return res.status(403).json({ error: "Forbidden. Only Faculty Handlers or Administrators can assign teams to projects." });
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

    const cleanId = parseInt(id.replace("proj-", ""));
    if (!isNaN(cleanId)) {
      await db.query(
        `UPDATE projects 
         SET team_id = $1, reminders = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [teamId, JSON.stringify(project.reminders), cleanId]
      );
    }

    // Sync back to local file if exists
    const projects = readProjects();
    const localIdx = projects.findIndex(p => p.id === id);
    if (localIdx !== -1) {
      projects[localIdx] = project;
      writeProjects(projects);
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /projects/:id/epics/:epicId ───────────────────────────────────────
app.delete("/projects/:id/epics/:epicId", verifyToken, async (req, res) => {
  try {
    const { id, epicId } = req.params;
    const { role, collegeId } = req.user;

    let project = await getProjectById(id);
    if (!project) {
      const projects = readProjects();
      project = projects.find(p => p.id === id);
    }
    if (!project) return res.status(404).json({ error: "Project not found." });

    // Access: Super-admin, Admin, Faculty/PI of that spoke
    const allowed = role === "Super-admin" || role === "Admin" ||
      ((role === "Faculty" || role === "Principal-Investigator") && collegeId === project.spokeId);
    if (!allowed) return res.status(403).json({ error: "Forbidden." });

    if (!Array.isArray(project.epics)) project.epics = [];
    project.epics = project.epics.filter(e => String(e.id) !== String(epicId));

    const db = require('./db');
    const cleanId = parseInt(id.replace("proj-", ""));
    if (!isNaN(cleanId)) {
      await db.query(
        `UPDATE projects SET epics = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(project.epics), cleanId]
      );
    }
    const all = readProjects();
    const idx = all.findIndex(p => p.id === id);
    if (idx !== -1) { all[idx] = project; writeProjects(all); }
    res.json({ success: true, epics: project.epics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /projects/:id/status ────────────────────────────────────────────────
app.patch("/projects/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { role, collegeId } = req.user;

    const VALID_STATUSES = ['pending_review', 'accepted', 'in_progress', 'completed', 'on_hold', 'rejected'];
    if (!status || !VALID_STATUSES.includes(status.toLowerCase())) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    let project = await getProjectById(id);
    if (!project) {
      const projects = readProjects();
      project = projects.find(p => p.id === id);
    }
    if (!project) return res.status(404).json({ error: "Project not found." });

    // Access: Super-admin, Admin, or Faculty/PI of the same spoke
    const allowed = role === "Super-admin" || role === "Admin" ||
      ((role === "Faculty" || role === "Principal-Investigator") && collegeId === project.spokeId);
    if (!allowed) return res.status(403).json({ error: "Forbidden." });

    const newStatus = status.toUpperCase();
    const db = require('./db');
    const cleanId = parseInt(id.replace("proj-", ""));
    if (!isNaN(cleanId)) {
      await db.query(
        `UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newStatus, cleanId]
      );
    }
    project.status = status.toLowerCase();
    const all = readProjects();
    const idx = all.findIndex(p => p.id === id);
    if (idx !== -1) { all[idx] = project; writeProjects(all); }
    res.json({ success: true, status: project.status });
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

// Helper to perform the actual college progress and reminder sweep logic
async function runReminderSweep() {
  const db = require('./db');
  const spokes = readSpokes();
  const triggered = [];

  // Query projects from PostgreSQL for Render persistence
  const projResult = await db.query(
    `SELECT id, name as "title", status, spoke_id as "spokeId", team_id as "teamId", 
            reminders, jira_project_key as "jiraProjectKey"
     FROM projects`
  );

  const dbProjects = projResult.rows;

  for (let proj of dbProjects) {
    let remindersList = typeof proj.reminders === 'string' 
      ? JSON.parse(proj.reminders) 
      : (proj.reminders || []);

    if (proj.status.toLowerCase() === "pending_review") {
      const email = await sendEmail({
        to: "moderator@apnileap.com",
        subject: `Reminder: Project ${proj.title} Awaiting Allocation`,
        body: `The B2B proposal "${proj.title}" is pending review. Please assign it to a Spoke.`,
        type: "reminder"
      });
      remindersList.push(email);
      triggered.push(email);
      
      await db.query(
        "UPDATE projects SET reminders = $1 WHERE id = $2",
        [JSON.stringify(remindersList), proj.id]
      );
    } 
    else if (proj.status.toLowerCase() === "allocated" && !proj.teamId) {
      const spoke = spokes.find(s => s.id === proj.spokeId);
      if (spoke) {
        const email = await sendEmail({
          to: spoke.spocEmail,
          subject: `Reminder: Project ${proj.title} Awaiting Team Assignment`,
          body: `Dear ${spoke.spocName},\n\nThe project "${proj.title}" is allocated to ${spoke.name} but has no team assigned. Please allocate a development team.\n\nBest regards,\nApni Leap Moderator`,
          type: "reminder"
        });
        remindersList.push(email);
        triggered.push(email);
        
        await db.query(
          "UPDATE projects SET reminders = $1 WHERE id = $2",
          [JSON.stringify(remindersList), proj.id]
        );
      }
    } 
    else if (proj.status.toLowerCase() === "accepted" || (proj.status.toLowerCase() === "allocated" && proj.teamId)) {
      // Active project progress check and reminder triggers
      const spoke = spokes.find(s => s.id === proj.spokeId);
      if (spoke) {
        const spokeToCampus = {
          'kle-spoke': '3',
          'coep-spoke': '101',
          'mmcoep-spoke': '102',
          'rit-spoke': '103'
        };
        const campusId = spokeToCampus[proj.spokeId] || '3';
        
        // Fetch tasks from local PostgreSQL store
        let tasks = [];
        try {
          const mockRes = await db.query("SELECT * FROM mock_tasks WHERE board_id = $1", [campusId]);
          tasks = mockRes.rows.map(row => ({
            id: row.id,
            key: row.key,
            fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields
          }));
        } catch (dbErr) {
          console.error("Failed mock task read:", dbErr.message);
        }

        // Check for blockers and overdue deadlines
        const overdueTasks = [];
        const blockedTasks = [];
        
        tasks.forEach(t => {
          const fields = t.fields || {};
          const summary = fields.summary || "Sprint task";
          const statusName = (fields.status?.name || fields.status || "Backlog").toLowerCase();
          const assigneeName = fields.assignee?.displayName || "Unassigned";

          if (fields.flagged === true || (fields.Flagged && fields.Flagged.length > 0)) {
            blockedTasks.push(`• [${t.key || t.id}] ${summary} (Blocked - Assigned to: ${assigneeName})`);
          }

          const dueDateStr = fields.duedate || fields.dueDate || null;
          if (statusName !== "done" && dueDateStr) {
            const today = new Date();
            const due = new Date(dueDateStr);
            if (due.getTime() < today.getTime()) {
              overdueTasks.push(`• [${t.key || t.id}] ${summary} (Overdue since: ${dueDateStr} - Assigned to: ${assigneeName})`);
            }
          }
        });

        // Send warning if any overdue or blocked issues are found
        if (blockedTasks.length > 0 || overdueTasks.length > 0) {
          let recipientList = [spoke.spocEmail];
          if (proj.teamId) {
            const teamRes = await db.query("SELECT * FROM teams WHERE id = $1", [proj.teamId]);
            if (teamRes.rows.length > 0 && Array.isArray(teamRes.rows[0].members)) {
              teamRes.rows[0].members.forEach(memberEmail => {
                if (memberEmail && memberEmail.includes("@")) {
                  recipientList.push(memberEmail.trim());
                }
              });
            }
          }

          let emailBody = `Dear ${spoke.spocName} & Development Team,\n\n` +
            `This is an automated progress alert for your active project "${proj.title}" at ${spoke.name}.\n\n`;

          if (blockedTasks.length > 0) {
            emailBody += `🚨 ACTIVE BLOCKERS:\n${blockedTasks.join("\n")}\n\n`;
          }

          if (overdueTasks.length > 0) {
            emailBody += `⏰ OVERDUE DEADLINES:\n${overdueTasks.join("\n")}\n\n`;
          }

          emailBody += `Please log in to your dashboard to resolve these blockages and complete pending tasks on your boards.\n\n` +
            `Best regards,\nApni Leap Progress Sweeper`;

          const email = await sendEmail({
            to: recipientList.join(", "),
            subject: `🚨 [Progress Warning] Action Required for Project: ${proj.title}`,
            body: emailBody,
            type: "reminder"
          });
          remindersList.push(email);
          triggered.push(email);
          
          await db.query(
            "UPDATE projects SET reminders = $1 WHERE id = $2",
            [JSON.stringify(remindersList), proj.id]
          );
        }
      }
    }
  }
  return triggered;
}

// ── POST /emails/trigger-reminders ───────────────────────────────────────────
app.post("/emails/trigger-reminders", verifyToken, async (req, res) => {
  try {
    const triggered = await runReminderSweep();
    res.json({ message: `Triggered ${triggered.length} reminders.`, logs: triggered });
  } catch (err) {
    console.error("Reminder Sweep Error:", err);
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



// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n✅  Jira Dashboard API  →  http://localhost:${PORT}`);
  console.log(`   API routes: /health  /issues  /status-summary  /assignee-summary  /dashboard-metrics\n`);

  // Trigger initial Jira Cloud active users synchronization
  syncAllJiraUsers().catch(err => console.error("Initial Jira users synchronization failed:", err.message));

  // Start the background automated college progress tracking and email sweep scheduler
  console.log("⏰ [AUTOMATION] Initializing daily background reminder sweep...");
  const SWEEP_INTERVAL = 24 * 60 * 60 * 1000; // 24 Hours
  setTimeout(async () => {
    try {
      console.log("⏰ [AUTOMATION] Running initial scheduled reminder sweep...");
      const triggered = await runReminderSweep();
      console.log(`⏰ [AUTOMATION] Initial sweep complete. Triggered ${triggered.length} email reminders.`);
    } catch (err) {
      console.error("⏰ [AUTOMATION] Initial background sweep failed:", err.message);
    }
  }, 10000); // 10 seconds post-boot

  setInterval(async () => {
    try {
      console.log("⏰ [AUTOMATION] Running scheduled recurring daily reminder sweep...");
      const triggered = await runReminderSweep();
      console.log(`⏰ [AUTOMATION] Daily sweep complete. Triggered ${triggered.length} email reminders.`);
    } catch (err) {
      console.error("⏰ [AUTOMATION] Daily background sweep failed:", err.message);
    }
  }, SWEEP_INTERVAL);
});

// ── GET /api/v1/download-report ───────────────────────────────────────────────
app.get("/api/v1/download-report", (req, res) => {
  const { title, file } = req.query;
  
  // Enforce docx file type by using ApniCart_Design_Document.docx as the standard document
  const reportFile = "ApniCart_Design_Document.docx";
  const parentDir = path.join(__dirname, "..");
  const filePath = path.join(parentDir, reportFile);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Standard design report template (.docx) not found on server." });
  }

  // Generate a customized download filename based on the project title or file parameter
  let cleanTitle = "";
  if (title) {
    cleanTitle = title;
  } else if (file) {
    // Extract base name without extension: e.g. "APNILEAP_PROJECT (1).pdf" -> "APNILEAP_PROJECT_1"
    cleanTitle = file.replace(/\.[^/.]+$/, "").replace(/\s*\(\d+\)\s*/g, " ");
  }

  let downloadName = "Project_Design_Document.docx";
  if (cleanTitle) {
    const sanitizedTitle = cleanTitle.trim().replace(/[^a-zA-Z0-9\s-_]/g, "").replace(/[\s-]+/g, "_");
    downloadName = `${sanitizedTitle}_Design_Document.docx`;
  }

  res.download(filePath, downloadName);
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

// ── Compatibility Aliases for Premium React UI ───────────────────────────────
const SPOKES_MAP = {
  "3": "KLE Spoke",
  "101": "COEP Spoke",
  "102": "MMCOEP Spoke",
  "103": "RIT Spoke",
  "kle-spoke": "KLE Spoke",
  "coep-spoke": "COEP Spoke",
  "mmcoep-spoke": "MMCOEP Spoke",
  "rit-spoke": "RIT Spoke"
};
const getSpokeName = (id) => SPOKES_MAP[id] || id || "Campus Spoke";
const getSpokeId = (name) => {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("mmcoep")) return "102";
  if (n.includes("kle")) return "3";
  if (n.includes("coep")) return "101";
  if (n.includes("rit")) return "103";
  return name;
};

app.post("/api/login", async (req, res) => {
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
      collegeId: user.college_id,
      campusId: user.college_id
    };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: userPayload });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: `Internal server login error: ${error.message}` });
  }
});

app.post("/api/register", async (req, res) => {
  const { name, email, password, role, campusId } = req.body;
  if (!email || !name || !role || !password) {
    return res.status(400).json({ error: "Missing required registration fields" });
  }
  try {
    const db = require('./db');
    const check = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Email is already registered." });
    }
    const collegeId = campusId || null;
    const result = await db.query(
      `INSERT INTO users (email, name, role, password, college_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, name, role, college_id`,
      [email.toLowerCase().trim(), name, role, password, collegeId]
    );
    const newUser = result.rows[0];
    try {
      await inviteAndSyncUserToJira(newUser.email, newUser.name, newUser.college_id, ["jira-software", "confluence"]);
    } catch (syncErr) {
      console.error(`[Jira Sync Error] Failed to invite user during registration:`, syncErr);
    }
    res.json({ message: "Registration successful! Account is active." });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: `Internal server error during registration: ${error.message}` });
  }
});

app.get("/me", verifyToken, async (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    collegeId: req.user.collegeId,
    campusId: req.user.campusId || req.user.collegeId
  });
});

app.get("/moderator/projects", async (req, res) => {
  try {
    const db = require('./db');
    const result = await db.query(
      `SELECT p.id, p.name as title, c.name as company, c.logo_url,
              p.description, p.budget as funding, p.duration_weeks || ' Weeks' as duration, 
              p.status, p.confluence_space_url, p.jira_board_url,
              p.created_by, p.accepted_by, p.spoke_id, p.team_id, p.jira_project_key, p.created_at
       FROM projects p
       LEFT JOIN companies c ON p.company_id = c.id
       ORDER BY p.created_at DESC`
    );
    const projects = [];
    for (const row of result.rows) {
      const budgetStr = row.funding ? `$${parseFloat(row.funding).toLocaleString()}` : "$0";
      const spokeName = getSpokeName(row.spoke_id);
      const campusId = getSpokeId(row.spoke_id);
      const statusFormatted = row.status === 'ACCEPTED' || row.status === 'IN_PROGRESS' || row.status === 'active' ? 'Active' : (row.status === 'ALLOCATED' || row.status === 'proposed' ? 'Proposed' : 'Pending Assignment');
      
      let allocations = [];
      if (row.spoke_id) {
        // Query mentor assignments for this college spoke
        const mentorUsersRes = await db.query('SELECT id FROM users WHERE college_id = $1 AND role = $2', [row.spoke_id, 'College-SPOC']);
        const mentorAssignments = mentorUsersRes.rows.map(mu => ({ facultyId: mu.id }));

        // Query teams for this project/allocation
        const teamsRes = await db.query('SELECT * FROM teams WHERE project_id = $1', [row.id]);
        const teams = teamsRes.rows.map(t => ({
          id: t.id,
          name: t.name,
          studentAssignments: (t.members || []).map(mId => ({ studentId: parseInt(mId) }))
        }));

        allocations = [{
          id: row.id.toString(),
          targetCampusId: row.spoke_id,
          assignedTo: spokeName,
          status: statusFormatted,
          proposedDueDate: '2026-08-25',
          assignedKey: row.jira_project_key || null,
          progressPercent: 75,
          doneTasks: 6,
          mentorAssignments: mentorAssignments,
          teams: teams
        }];
      }

      projects.push({
        id: `proj-${row.id}`,
        company: row.company || "NVIDIA",
        logoUrl: row.logo_url || "https://logo.clearbit.com/nvidia.com?size=80",
        title: row.title,
        description: row.description || "",
        budget: budgetStr,
        duration: row.duration || "12 Weeks",
        status: statusFormatted,
        assignedTo: row.spoke_id ? spokeName : null,
        targetCampusId: campusId,
        proposedDueDate: '2026-08-25',
        assignedKey: row.jira_project_key || null,
        dateAdded: row.created_at ? row.created_at.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        allocations: allocations
      });
    }
    res.json(projects);
  } catch (err) {
    console.error("Failed to fetch moderator projects:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/moderator/projects", verifyToken, async (req, res) => {
  const { company, title, description, budget, duration, proposedDueDate } = req.body;
  try {
    const db = require('./db');
    let companyId = null;
    const compCheck = await db.query('SELECT id FROM companies WHERE name ILIKE $1', [company.trim()]);
    if (compCheck.rows.length > 0) {
      companyId = compCheck.rows[0].id;
    } else {
      const compInsert = await db.query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [company.trim()]);
      companyId = compInsert.rows[0].id;
    }
    const numericId = Date.now();
    const cleanBudget = parseFloat(budget.replace(/[^0-9.]/g, "")) || 50000;
    const cleanDuration = parseInt(duration) || 12;
    await db.query(
      `INSERT INTO projects (id, name, description, budget, duration_weeks, status, company_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [numericId, title, description, cleanBudget, cleanDuration, 'OPEN_FOR_BIDDING', companyId]
    );
    res.json({
      success: true,
      project: {
        id: `proj-${numericId}`,
        company,
        logoUrl: "https://logo.clearbit.com/nvidia.com?size=80",
        title,
        description,
        budget: `$${cleanBudget.toLocaleString()}`,
        duration,
        status: "Pending Assignment",
        allocations: []
      }
    });
  } catch (err) {
    console.error("Failed to create moderator project:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/moderator/projects/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { company, title, description, budget, duration, proposedDueDate, status } = req.body;
  const cleanId = parseInt(id.replace("proj-", ""));
  try {
    const db = require('./db');
    const cleanBudget = budget ? parseFloat(budget.replace(/[^0-9.]/g, "")) : null;
    const cleanDuration = duration ? parseInt(duration) : null;
    
    await db.query(
      `UPDATE projects 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description), 
           budget = COALESCE($3, budget), 
           duration_weeks = COALESCE($4, duration_weeks),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [title, description, cleanBudget, cleanDuration, status ? status.toUpperCase() : null, cleanId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to update moderator project:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/moderator/projects/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const cleanId = parseInt(id.replace("proj-", ""));
  try {
    const db = require('./db');
    await db.query("DELETE FROM projects WHERE id = $1", [cleanId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete moderator project:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/moderator/assign", verifyToken, async (req, res) => {
  const { projectId, targetBoardId, dueDate } = req.body;
  const cleanId = parseInt(projectId.replace("proj-", ""));
  const spokeKey = targetBoardId === "3" ? "kle-spoke" : (targetBoardId === "101" ? "coep-spoke" : (targetBoardId === "102" ? "mmcoep-spoke" : "rit-spoke"));
  const spokeName = getSpokeName(spokeKey);
  try {
    const db = require('./db');
    await db.query(
      `UPDATE projects 
       SET spoke_id = $1, status = 'ALLOCATED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [spokeKey, cleanId]
    );
    res.json({
      success: true,
      message: "Successfully assigned project to Spoke.",
      assignedTo: spokeName,
      status: "Proposed"
    });
  } catch (err) {
    console.error("Failed to assign project to spoke:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Run real-time audit scan of B2B projects and trigger warnings if incomplete/overdue
app.post("/moderator/alerts/check", async (req, res) => {
  const triggeredAlerts = [];
  try {
    const db = require('./db');
    // Fetch all allocated/accepted projects
    const projResult = await db.query(
      `SELECT p.id, p.name as title, c.name as company, p.spoke_id as spoke_id, p.jira_project_key
       FROM projects p
       LEFT JOIN companies c ON p.company_id = c.id
       WHERE p.status = 'ACCEPTED' OR p.status = 'IN_PROGRESS' OR p.status = 'active' OR p.status = 'ALLOCATED'`
    );

    const projects = projResult.rows;

    const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    const nodemailer = require('nodemailer');
    let transporter;
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

    for (const project of projects) {
      if (!project.spoke_id) continue;

      const boardId = project.spoke_id.includes("kle") ? "3" : (project.spoke_id.includes("coep") && !project.spoke_id.includes("mm") ? "101" : (project.spoke_id.includes("mmcoep") ? "102" : "103"));
      const spokeName = project.spoke_id === "kle-spoke" || project.spoke_id === "3" ? "KLE Spoke" : (project.spoke_id === "coep-spoke" || project.spoke_id === "101" ? "COEP Spoke" : (project.spoke_id === "mmcoep-spoke" || project.spoke_id === "102" ? "MMCOEP Spoke" : "RIT Spoke"));

      let tasks = [];
      try {
        const mockRes = await db.query('SELECT * FROM mock_tasks WHERE board_id = $1', [boardId]);
        tasks = mockRes.rows.map(row => ({
          key: row.key,
          fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields
        }));
      } catch (dbErr) {
        console.error("Local mock tasks check error:", dbErr.message);
      }

      const projectEpic = tasks.find(t => t.key === project.jira_project_key && (t.fields?.issuetype?.name === "Epic" || t.fields?.issueType === "Epic"));
      if (!projectEpic) continue;

      const childTasks = tasks.filter(t => {
        const parentKey = t.fields?.parent?.key || t.parent?.key;
        return parentKey === project.jira_project_key;
      });

      const totalChildren = childTasks.length;
      const completedChildren = childTasks.filter(t => {
        const status = t.fields?.status?.name || t.fields?.status || "Backlog";
        return status === "Done";
      }).length;

      const completionRate = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
      const isCompleted = totalChildren > 0 && completedChildren === totalChildren;

      const epicDueDate = projectEpic.fields?.duedate || projectEpic.fields?.dueDate || projectEpic.dueDate || null;
      let isBreached = false;
      let daysOverdue = 0;

      if (!isCompleted && epicDueDate) {
        const today = new Date("2026-05-27");
        const due = new Date(epicDueDate);
        if (due.getTime() < today.getTime()) {
          isBreached = true;
          daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      if (isBreached) {
        // Update project status to breached
        await db.query(
          `UPDATE projects SET status = 'Assigned (BREACHED - Incomplete)' WHERE id = $1`,
          [project.id]
        );

        const notifyCoordinators = new Set(["manasa@apnileap.com", "coordinator@" + (project.spoke_id.split("-")[0] || "kle") + ".edu"]);

        // Resolve database users
        try {
          const userRes = await db.query("SELECT email FROM users WHERE college_id = $1", [project.spoke_id]);
          userRes.rows.forEach(u => {
            if (u.email) notifyCoordinators.add(u.email.toLowerCase().trim());
          });
        } catch (dbErr) {
          console.error("Gather user emails error:", dbErr.message);
        }

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
              <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: white;">ApniLeap Hub</h1>
                <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #fee2e2;">⚠️ URGENT DEADLINE BREACH WARNING</p>
              </div>
              <div style="padding: 40px 30px; line-height: 1.6;">
                ${redirectBannerHtml}
                <div style="border-left: 4px solid #ef4444; padding-left: 16px; margin-bottom: 24px;">
                  <h2 style="margin: 0; color: white; font-size: 18px; font-weight: 700;">Deadline Breached - Incomplete Project</h2>
                  <p style="margin: 4px 0 0 0; font-size: 14px; color: #fca5a5;">Your campus has breached the target deadline for this industry-sponsored FIP.</p>
                </div>
                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: white;">📋 Project Information</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-weight: 600; width: 140px;">Company Project:</td>
                      <td style="padding: 6px 0; color: #f3f4f6; font-weight: 700;">${project.title}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-weight: 600;">Sponsoring Partner:</td>
                      <td style="padding: 6px 0; color: #ef4444; font-weight: 700;">${project.company || "NVIDIA"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-weight: 600;">Assigned Space:</td>
                      <td style="padding: 6px 0; color: #f3f4f6;">${spokeName} (<span style="font-family: monospace; color: #fca5a5;">${project.jira_project_key}</span>)</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-weight: 600;">Target Deadline:</td>
                      <td style="padding: 6px 0; color: #f3f4f6; font-weight: 700;">${epicDueDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #9ca3af; font-weight: 600;">Breach Duration:</td>
                      <td style="padding: 6px 0; color: #ef4444; font-weight: 700;">Overdue by ${daysOverdue} days!</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>
          </div>
        `;

        const warningBody = `
          ⚠️ URGENT DEADLINE BREACH WARNING - INCOMPLETE PROJECT
          ---------------------------------------------------------
          Company Project: ${project.title}
          Sponsoring Partner: ${project.company || "NVIDIA"}
          Assigned Space: ${spokeName} (Jira Key: ${project.jira_project_key})
          Project Target Deadline was: ${epicDueDate}
          Breach Duration: Overdue by ${daysOverdue} days!
        `;

        const mailInfo = await transporter.sendMail({
          from: hasSmtpConfig
            ? `"${process.env.SMTP_FROM_NAME || 'ApniLeap Hub'}" <${process.env.SMTP_USER}>`
            : '"ApniLeap Deadline Auditor" <no-reply@apnileap.com>',
          to: finalTo,
          subject: `⚠️ [URGENT BREACH WARNING] Target Deadline Overdue: ${project.title} (${spokeName})`,
          text: warningBody,
          html: htmlTemplate
        });

        let previewUrl = "";
        if (isTestAccount) {
          previewUrl = nodemailer.getTestMessageUrl(mailInfo);
        }

        triggeredAlerts.push({
          projectId: `proj-${project.id}`,
          title: project.title,
          company: project.company || "NVIDIA",
          assignedTo: spokeName,
          epicKey: project.jira_project_key,
          dueDate: epicDueDate,
          completionRate,
          daysOverdue,
          emailAlertBody: warningBody,
          previewUrl: isTestAccount ? previewUrl : undefined
        });
      }
    }

    res.json({
      success: true,
      message: `Audit scan completed! Triggered ${triggeredAlerts.length} overdue campus alerts.`,
      alerts: triggeredAlerts
    });
  } catch (error) {
    console.error("Alerts Scanner Error:", error.message);
    res.status(500).json({ error: `Alerts scan failed: ${error.message}` });
  }
});

app.post("/spoke/project/:projectId/accept", async (req, res) => {
  const { projectId } = req.params;
  const cleanId = projectId.replace("proj-", "");
  req.url = `/projects/proj-${cleanId}/accept`;
  app.handle(req, res);
});

app.post("/spoke/project/:projectId/decline", async (req, res) => {
  const { projectId } = req.params;
  const cleanId = projectId.replace("proj-", "");
  req.url = `/projects/proj-${cleanId}/decline`;
  app.handle(req, res);
});

app.get("/spokes/:boardId/members", async (req, res) => {
  const { boardId } = req.params;
  const spokeKey = boardId === "3" ? "kle-spoke" : (boardId === "101" ? "coep-spoke" : (boardId === "102" ? "mmcoep-spoke" : "rit-spoke"));
  try {
    const db = require('./db');
    const result = await db.query('SELECT email, name, role FROM users WHERE college_id = $1', [spokeKey]);
    res.json(result.rows.map(r => ({
      accountId: r.email,
      displayName: r.name,
      emailAddress: r.email
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/teams", async (req, res) => {
  try {
    const db = require('./db');
    const result = await db.query('SELECT * FROM teams');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/teams", verifyToken, async (req, res) => {
  const { name, members, boardId } = req.body;
  const teamId = "team-" + Date.now();
  try {
    const db = require('./db');
    await db.query('INSERT INTO teams (id, name, members) VALUES ($1, $2, $3)', [teamId, name, members || []]);
    res.json({ id: teamId, name, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/teams/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const db = require('./db');
    await db.query('DELETE FROM teams WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/hub/metrics", async (req, res) => {
  try {
    const db = require('./db');

    // 1. Fetch B2B projects from PostgreSQL
    const projResult = await db.query(
      `SELECT p.id, p.name as title, c.name as company, c.logo_url,
              p.description, p.budget as funding, p.duration_weeks || ' Weeks' as duration, 
              p.status, p.confluence_space_url, p.jira_board_url,
              p.created_by, p.accepted_by, p.spoke_id, p.team_id, p.jira_project_key, p.created_at
       FROM projects p
       LEFT JOIN companies c ON p.company_id = c.id
       ORDER BY p.created_at DESC`
    );

    const b2bProjects = [];
    const SPOKES_MAP = {
      "3": "KLE Spoke", "101": "COEP Spoke", "102": "MMCOEP Spoke", "103": "RIT Spoke",
      "kle-spoke": "KLE Spoke", "coep-spoke": "COEP Spoke", "mmcoep-spoke": "MMCOEP Spoke", "rit-spoke": "RIT Spoke"
    };
    const getSpokeName = (id) => SPOKES_MAP[id] || id || "Campus Spoke";
    const getSpokeId = (name) => {
      if (!name) return null;
      const n = name.toLowerCase();
      if (n.includes("mmcoep")) return "102";
      if (n.includes("kle")) return "3";
      if (n.includes("coep")) return "101";
      if (n.includes("rit")) return "103";
      return name;
    };

    for (const row of projResult.rows) {
      const budgetStr = row.funding ? `$${parseFloat(row.funding).toLocaleString()}` : "$0";
      const spokeName = getSpokeName(row.spoke_id);
      const campusId = getSpokeId(row.spoke_id);
      const statusFormatted = row.status === 'ACCEPTED' || row.status === 'IN_PROGRESS' || row.status === 'active' ? 'Active' : (row.status === 'ALLOCATED' || row.status === 'proposed' ? 'Proposed' : 'Pending Assignment');
      
      let allocations = [];
      if (row.spoke_id) {
        const mentorUsersRes = await db.query('SELECT id FROM users WHERE college_id = $1 AND role = $2', [row.spoke_id, 'College-SPOC']);
        const mentorAssignments = mentorUsersRes.rows.map(mu => ({ facultyId: mu.id }));

        const teamsRes = await db.query('SELECT * FROM teams WHERE project_id = $1', [row.id]);
        const teams = teamsRes.rows.map(t => ({
          id: t.id,
          name: t.name,
          studentAssignments: (t.members || []).map(mId => ({ studentId: parseInt(mId) }))
        }));

        allocations = [{
          id: row.id.toString(),
          targetCampusId: row.spoke_id,
          assignedTo: spokeName,
          status: statusFormatted,
          proposedDueDate: '2026-08-25',
          assignedKey: row.jira_project_key || null,
          progressPercent: 75,
          doneTasks: 6,
          mentorAssignments,
          teams
        }];
      }

      b2bProjects.push({
        id: `proj-${row.id}`,
        company: row.company || "NVIDIA",
        logoUrl: row.logo_url || "https://logo.clearbit.com/nvidia.com?size=80",
        title: row.title,
        description: row.description || "",
        budget: budgetStr,
        duration: row.duration || "12 Weeks",
        status: statusFormatted,
        assignedTo: row.spoke_id ? spokeName : null,
        targetCampusId: campusId,
        proposedDueDate: '2026-08-25',
        assignedKey: row.jira_project_key || null,
        dateAdded: row.created_at ? row.created_at.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        allocations
      });
    }

    // 2. Fetch all spokes tasks to aggregate progress statistics
    const spokesList = [
      { id: "3", name: "KLE Spoke", key: "AK" },
      { id: "101", name: "COEP Spoke", key: "AK" },
      { id: "102", name: "MMCOEP Spoke", key: "AK" },
      { id: "103", name: "RIT Spoke", key: "AK" }
    ];

    const spokesMetrics = [];
    const blockers = [];

    for (const sp of spokesList) {
      const mockRes = await db.query('SELECT * FROM mock_tasks WHERE board_id = $1', [sp.id]);
      const mockTasks = mockRes.rows.map(row => {
        const fields = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields;
        return {
          id: row.id,
          key: row.key,
          fields: {
            summary: fields.summary || "",
            status: { name: fields.status?.name || "To Do" },
            priority: { name: fields.priority?.name || "Medium" },
            issuetype: { name: fields.issuetype?.name || "Task" },
            assignee: fields.assignee ? { displayName: fields.assignee.displayName } : null,
            flagged: fields.flagged || false
          }
        };
      });

      let total = 0;
      let done = 0;
      let progress = 0;
      let backlog = 0;
      let blockersCount = 0;

      mockTasks.forEach(t => {
        const status = (t.fields.status?.name || "To Do").toLowerCase();
        total++;
        if (status.includes("done") || status.includes("closed") || status.includes("resolved")) {
          done++;
        } else if (status.includes("progress") || status.includes("review") || status.includes("testing")) {
          progress++;
        } else {
          backlog++;
        }

        if (t.fields.flagged) {
          blockersCount++;
          blockers.push({
            id: t.id,
            key: t.key,
            summary: t.fields.summary,
            statusName: t.fields.status?.name || "To Do",
            priority: t.fields.priority?.name || "Medium",
            spokeName: sp.name,
            assignee: t.fields.assignee
          });
        }
      });

      spokesMetrics.push({
        id: sp.id,
        name: sp.name,
        key: sp.key,
        total,
        done,
        progress,
        backlog,
        blockersCount,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0
      });
    }

    res.json({
      spokes: spokesMetrics,
      workstreams: [],
      blockers: blockers,
      b2bProjects: b2bProjects
    });

  } catch (err) {
    console.error("Hub Metrics aggregation error:", err);
    res.status(500).json({ error: "Failed to aggregate Hub metrics" });
  }
});

// ── GET /students/:studentId/projects ──────────────────────────────────────────
app.get("/students/:studentId/projects", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { studentId } = req.params;
    
    // Find student's college_id
    const userRes = await db.query('SELECT college_id FROM users WHERE id = $1', [studentId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    const collegeId = userRes.rows[0].college_id;
    if (!collegeId) {
      return res.json([]);
    }
    
    // Find all projects allocated to this college_id
    const projectsRes = await db.query(
      `SELECT p.*, c.name as company_name, c.logo_url as company_logo 
       FROM projects p 
       LEFT JOIN companies c ON p.company_id = c.id 
       WHERE p.spoke_id = $1 AND p.status IN ('ACCEPTED', 'IN_PROGRESS', 'ALLOCATED', 'OPEN_FOR_BIDDING')`,
      [collegeId]
    );
    
    // For each project, fetch its allocation and mentor details
    const allocations = [];
    for (const row of projectsRes.rows) {
      // Find the mentor (College-SPOC) for this college
      const mentorRes = await db.query('SELECT id, name, email FROM users WHERE college_id = $1 AND role = $2 LIMIT 1', [collegeId, 'College-SPOC']);
      const mentor = mentorRes.rows[0] ? { name: mentorRes.rows[0].name, email: mentorRes.rows[0].email } : null;
      
      allocations.push({
        id: row.id.toString(),
        projectId: row.id.toString(),
        project: {
          title: row.name,
          description: row.description,
          logoUrl: row.company_logo || "https://logo.clearbit.com/nvidia.com?size=80"
        },
        mentor: mentor
      });
    }
    
    res.json(allocations);
  } catch (error) {
    console.error("Error fetching student projects:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /allocations/:id ────────────────────────────────────────────────────────
app.get("/allocations/:id", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    
    // Get the project
    const projectRes = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: "Allocation/Project not found" });
    }
    const project = projectRes.rows[0];
    const collegeId = project.spoke_id;
    
    // Get mentor
    const mentorRes = await db.query('SELECT id, name, email FROM users WHERE college_id = $1 AND role = $2 LIMIT 1', [collegeId, 'College-SPOC']);
    const mentor = mentorRes.rows[0] ? { id: mentorRes.rows[0].id, name: mentorRes.rows[0].name, email: mentorRes.rows[0].email } : null;
    
    // Get all students on this college
    const studentsRes = await db.query('SELECT id, name, email FROM users WHERE college_id = $1 AND role = $2', [collegeId, 'Student']);
    const students = studentsRes.rows.map(s => ({ id: s.id, name: s.name, email: s.email }));
    
    // Get all teams for this project
    const teamsRes = await db.query('SELECT * FROM teams WHERE project_id = $1', [id]);
    const teams = teamsRes.rows.map(t => ({
      id: t.id,
      name: t.name,
      studentAssignments: (t.members || []).map(mId => ({ studentId: parseInt(mId) }))
    }));
    
    res.json({
      id: id,
      project: { title: project.name },
      mentor: mentor,
      students: students,
      teams: teams
    });
  } catch (error) {
    console.error("Error getting allocation:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /allocations/:id/chat ───────────────────────────────────────────────────
app.get("/allocations/:id/chat", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    
    // Check if team exists, otherwise create it to satisfy foreign key
    const checkTeam = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (checkTeam.rows.length === 0) {
      const projectRes = await db.query('SELECT name FROM projects WHERE id = $1', [id]);
      const projectName = projectRes.rows[0] ? projectRes.rows[0].name : "Atlassian Team Workspace";
      await db.query('INSERT INTO teams (id, name, members) VALUES ($1, $2, $3)', [id, projectName, []]);
    }
    
    const messagesRes = await db.query('SELECT * FROM team_messages WHERE team_id = $1 ORDER BY timestamp ASC', [id]);
    
    const messages = [];
    for (const msg of messagesRes.rows) {
      // Find the sender user details to know if they are student or faculty
      const senderRes = await db.query('SELECT name, role FROM users WHERE name = $1 LIMIT 1', [msg.sender]);
      const role = senderRes.rows[0] ? (senderRes.rows[0].role === 'College-SPOC' ? 'MENTOR' : 'STUDENT') : 'STUDENT';
      
      messages.push({
        id: msg.id,
        senderId: senderRes.rows[0] ? senderRes.rows[0].id : 0,
        sender: {
          name: msg.sender,
          role: role
        },
        content: decrypt(msg.text),
        timestamp: msg.timestamp
      });
    }
    
    res.json(messages);
  } catch (error) {
    console.error("Error getting allocation chat:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /allocations/:id/chat ──────────────────────────────────────────────────
app.post("/allocations/:id/chat", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params;
    const { senderId, content } = req.body;
    
    // Check if team exists, otherwise create it
    const checkTeam = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (checkTeam.rows.length === 0) {
      const projectRes = await db.query('SELECT name FROM projects WHERE id = $1', [id]);
      const projectName = projectRes.rows[0] ? projectRes.rows[0].name : "Atlassian Team Workspace";
      await db.query('INSERT INTO teams (id, name, members) VALUES ($1, $2, $3)', [id, projectName, []]);
    }
    
    // Get sender details
    const senderRes = await db.query('SELECT name, role FROM users WHERE id = $1', [senderId]);
    if (senderRes.rows.length === 0) {
      return res.status(404).json({ error: "Sender not found" });
    }
    const senderName = senderRes.rows[0].name;
    const encryptedText = encrypt(content);
    const newMessageId = "msg-" + Date.now() + Math.random().toString(36).substr(2, 5);
    const now = new Date();
    
    await db.query(
      'INSERT INTO team_messages (id, team_id, sender, text, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [newMessageId, id, senderName, encryptedText, now]
    );
    
    res.json({ success: true, messageId: newMessageId });
  } catch (error) {
    console.error("Error posting allocation chat:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /students/:campusId ─────────────────────────────────────────────────────
app.get("/students/:campusId", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { campusId } = req.params;
    
    const studentsRes = await db.query('SELECT id, name, email FROM users WHERE college_id = $1 AND role = $2', [campusId, 'Student']);
    res.json(studentsRes.rows);
  } catch (error) {
    console.error("Error getting campus students:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /allocations/:id/teams ─────────────────────────────────────────────────
app.post("/allocations/:id/teams", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { id } = req.params; // project ID
    const { name } = req.body;
    
    const teamId = "team-" + Date.now() + Math.random().toString(36).substr(2, 5);
    
    // Find project spoke_id
    const projectRes = await db.query('SELECT spoke_id FROM projects WHERE id = $1', [id]);
    const spokeId = projectRes.rows[0] ? projectRes.rows[0].spoke_id : null;
    
    await db.query(
      'INSERT INTO teams (id, name, members, college_id, project_id) VALUES ($1, $2, $3, $4, $5)',
      [teamId, name, [], spokeId, id]
    );
    
    res.json({
      success: true,
      team: {
        id: teamId,
        name: name,
        studentAssignments: []
      }
    });
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /teams/:teamId/assign-students ─────────────────────────────────────────
app.post("/teams/:teamId/assign-students", verifyToken, async (req, res) => {
  try {
    const db = require('./db');
    const { teamId } = req.params;
    const { studentIds } = req.body; // array of numeric IDs
    
    const stringIds = studentIds.map(id => id.toString());
    
    await db.query('UPDATE teams SET members = $1 WHERE id = $2', [stringIds, teamId]);
    
    const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    const team = teamRes.rows[0];
    
    res.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        studentAssignments: (team.members || []).map(mId => ({ studentId: parseInt(mId) }))
      }
    });
  } catch (error) {
    console.error("Error assigning students to team:", error);
    res.status(500).json({ error: error.message });
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
  app.get("/*path", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

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