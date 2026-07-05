const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getGitLabBaseUrl = () => process.env.GITLAB_BASE_URL || "http://localhost:8080";
const getGitLabToken = () => process.env.GITLAB_TOKEN || "";
const getParentGroupId = () => process.env.GITLAB_PARENT_GROUP_ID || "";

const getHeaders = () => {
  const token = getGitLabToken();
  return {
    'PRIVATE-TOKEN': token,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
};

const hasGitLab = () => !!getGitLabToken();

// Create GitLab Group / Subgroup
async function createGitLabGroup(name, pathName) {
  const base = getGitLabBaseUrl();
  const parentId = getParentGroupId();
  
  if (!hasGitLab()) {
    console.warn("[GitLab] Token not set. Returning mock group.");
    return { id: 999 + Math.floor(Math.random() * 100), name, path: pathName, full_path: pathName };
  }

  const payload = {
    name: name,
    path: pathName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    visibility: 'private'
  };

  if (parentId) {
    payload.parent_id = parseInt(parentId);
  }

  try {
    console.log(`[GitLab] Creating group: ${name} | Path: ${payload.path}`);
    const res = await axios.post(`${base}/api/v4/groups`, payload, { headers: getHeaders(), timeout: 10000 });
    return res.data;
  } catch (err) {
    // If group already exists, try fetching it
    if (err.response?.status === 400 && err.response?.data?.message?.path?.includes("has already been taken")) {
      console.log(`[GitLab] Group path ${payload.path} taken. Fetching existing group...`);
      try {
        const fetchRes = await axios.get(`${base}/api/v4/groups/${encodeURIComponent(payload.path)}`, { headers: getHeaders() });
        return fetchRes.data;
      } catch (fetchErr) {
        console.error("[GitLab] Failed to fetch existing group:", fetchErr.message);
      }
    }
    console.error("[GitLab] Create group failed:", err.response?.data || err.message);
    return { id: 999, name, path: pathName, full_path: pathName };
  }
}

// Create GitLab Project / Repository inside Group namespace
async function createGitLabProject(namespaceId, name, description = "") {
  const base = getGitLabBaseUrl();

  if (!hasGitLab()) {
    console.warn("[GitLab] Token not set. Returning mock project.");
    const cleanName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return {
      id: 8888 + Math.floor(Math.random() * 100),
      name,
      path_with_namespace: `mock-group/${cleanName}`,
      web_url: `${base}/mock-group/${cleanName}`
    };
  }

  const payload = {
    name: name,
    description: description,
    visibility: 'private',
    namespace_id: namespaceId,
    initialize_with_readme: true
  };

  try {
    console.log(`[GitLab] Creating project "${name}" in namespace ID: ${namespaceId}`);
    const res = await axios.post(`${base}/api/v4/projects`, payload, { headers: getHeaders(), timeout: 10000 });
    return res.data;
  } catch (err) {
    if (err.response?.status === 400 && err.response?.data?.message?.name?.includes("has already been taken")) {
      console.log(`[GitLab] Project name ${name} taken in group. Attempting to search existing project...`);
      try {
        const searchRes = await axios.get(`${base}/api/v4/groups/${namespaceId}/projects?search=${encodeURIComponent(name)}`, { headers: getHeaders() });
        if (searchRes.data && searchRes.data.length > 0) {
          return searchRes.data[0];
        }
      } catch (searchErr) {
        console.error("[GitLab] Failed to fetch existing project:", searchErr.message);
      }
    }
    console.error("[GitLab] Create project failed:", err.response?.data || err.message);
    const cleanName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return { id: 8888, name, path_with_namespace: `mock-group/${cleanName}`, web_url: `${base}/mock-group/${cleanName}` };
  }
}

// Ensure Standard Labels Exist on Project
async function ensureGitLabLabels(projectId) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) return;

  const defaultLabels = [
    { name: "To Do", color: "#f59e0b" },
    { name: "In Progress", color: "#3b82f6" },
    { name: "In Review", color: "#8b5cf6" },
    { name: "Testing", color: "#ec4899" },
    { name: "Done", color: "#10b981" },
    { name: "Epic", color: "#6b7280" }
  ];

  for (const label of defaultLabels) {
    try {
      await axios.post(`${base}/api/v4/projects/${projectId}/labels`, label, { headers: getHeaders() });
    } catch (err) {
      // 409 means label already exists, which is fine
      if (err.response?.status !== 409) {
        console.warn(`[GitLab] Could not ensure label "${label.name}":`, err.message);
      }
    }
  }
}

// Create GitLab Kanban Board for the Project
async function createGitLabIssueBoard(projectId, boardName) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) {
    return { id: 777, name: boardName, web_url: `${base}/mock-project/boards` };
  }

  try {
    await ensureGitLabLabels(projectId);

    console.log(`[GitLab] Creating Issue Board: ${boardName}`);
    const res = await axios.post(`${base}/api/v4/projects/${projectId}/boards`, { name: boardName }, { headers: getHeaders() });
    const board = res.data;

    // Create Board Lists for Status Labels
    const lists = ["To Do", "In Progress", "In Review", "Testing", "Done"];
    
    // First retrieve label IDs
    const labelRes = await axios.get(`${base}/api/v4/projects/${projectId}/labels`, { headers: getHeaders() });
    const labelsMap = labelRes.data || [];

    for (const labelName of lists) {
      const matchedLabel = labelsMap.find(l => l.name === labelName);
      if (matchedLabel) {
        try {
          await axios.post(`${base}/api/v4/projects/${projectId}/boards/${board.id}/lists`, { label_id: matchedLabel.id }, { headers: getHeaders() });
        } catch (listErr) {
          // List might already exist
        }
      }
    }
    return board;
  } catch (err) {
    console.error("[GitLab] Create board failed:", err.response?.data || err.message);
    return { id: 777, name: boardName, web_url: `${base}/projects/${projectId}/boards` };
  }
}

// Create GitLab Issue (replaces Jira task / epic issue)
async function createGitLabIssue(projectId, summary, description = "", labels = [], assigneeIds = []) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) {
    const mockIid = 100 + Math.floor(Math.random() * 900);
    return {
      id: 66666 + mockIid,
      iid: mockIid,
      title: summary,
      description,
      labels,
      web_url: `${base}/mock-project/issues/${mockIid}`
    };
  }

  const payload = {
    title: summary,
    description: description,
    labels: labels.join(','),
    assignee_ids: assigneeIds
  };

  try {
    console.log(`[GitLab] Creating issue: "${summary}" on project: ${projectId}`);
    const res = await axios.post(`${base}/api/v4/projects/${projectId}/issues`, payload, { headers: getHeaders() });
    return res.data;
  } catch (err) {
    console.error("[GitLab] Create issue failed:", err.response?.data || err.message);
    const mockIid = 100 + Math.floor(Math.random() * 900);
    return { id: 66666, iid: mockIid, title: summary, description, labels, web_url: `${base}/mock-project/issues/${mockIid}` };
  }
}

// Link standard GitLab Issues (used to connect child tasks to parent Epics)
async function linkGitLabIssues(projectId, parentIssueIid, childIssueIid) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) return true;

  try {
    console.log(`[GitLab] Linking child issue #${childIssueIid} to parent epic #${parentIssueIid}`);
    await axios.post(
      `${base}/api/v4/projects/${projectId}/issues/${parentIssueIid}/links`,
      { target_project_id: projectId, target_issue_iid: childIssueIid },
      { headers: getHeaders() }
    );
    return true;
  } catch (err) {
    console.warn("[GitLab] Issue linking failed:", err.response?.data || err.message);
    return false;
  }
}

// Transition Issue Status by changing GitLab Labels
async function transitionGitLabIssue(projectId, issueIid, newStatus) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) return true;

  try {
    // 1. Get current issue to inspect its labels
    const getRes = await axios.get(`${base}/api/v4/projects/${projectId}/issues/${issueIid}`, { headers: getHeaders() });
    const currentLabels = getRes.data.labels || [];

    const statuses = ["To Do", "In Progress", "In Review", "Testing", "Done"];
    const normalizedNewStatus = statuses.find(s => s.toLowerCase() === newStatus.toLowerCase()) || "To Do";

    // 2. Remove old status labels and append the new one
    let cleanLabels = currentLabels.filter(lbl => !statuses.includes(lbl));
    cleanLabels.push(normalizedNewStatus);

    console.log(`[GitLab] Transitioning issue #${issueIid} to status: "${normalizedNewStatus}"`);
    await axios.put(
      `${base}/api/v4/projects/${projectId}/issues/${issueIid}`,
      { labels: cleanLabels.join(',') },
      { headers: getHeaders() }
    );
    return true;
  } catch (err) {
    console.error(`[GitLab] Transition issue #${issueIid} failed:`, err.response?.data || err.message);
    return false;
  }
}

// Add Notes/Comments to an Issue
async function createGitLabIssueNote(projectId, issueIid, body) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) {
    return { id: 5555, body, created_at: new Date().toISOString() };
  }

  try {
    console.log(`[GitLab] Appending comment note to issue #${issueIid}`);
    const res = await axios.post(
      `${base}/api/v4/projects/${projectId}/issues/${issueIid}/notes`,
      { body: body },
      { headers: getHeaders() }
    );
    return res.data;
  } catch (err) {
    console.error(`[GitLab] Failed to add note to issue #${issueIid}:`, err.response?.data || err.message);
    return { id: 5555, body, created_at: new Date().toISOString() };
  }
}

// Get Notes/Comments of an Issue
async function getGitLabIssueNotes(projectId, issueIid) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) return [];

  try {
    const res = await axios.get(`${base}/api/v4/projects/${projectId}/issues/${issueIid}/notes`, { headers: getHeaders() });
    return res.data || [];
  } catch (err) {
    console.error(`[GitLab] Failed to fetch notes for issue #${issueIid}:`, err.message);
    return [];
  }
}

// Commit files via GitLab API (used to automatically deploy .gitlab-ci.yml templates)
async function commitGitLabCIYaml(projectId, content, commitMessage = "Add GitLab CI/CD configuration") {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) {
    console.log("[GitLab] Token not set. Skipping CI template commit.");
    return true;
  }

  try {
    const filePath = ".gitlab-ci.yml";
    const payload = {
      branch: "main",
      commit_message: commitMessage,
      actions: [
        {
          action: "create",
          file_path: filePath,
          content: content
        }
      ]
    };

    console.log(`[GitLab] Committing .gitlab-ci.yml template to project: ${projectId}`);
    await axios.post(`${base}/api/v4/projects/${projectId}/repository/commits`, payload, { headers: getHeaders(), timeout: 10000 });
    return true;
  } catch (err) {
    // If already exists, try update
    if (err.response?.status === 400 && JSON.stringify(err.response?.data).includes("already exists")) {
      try {
        const payloadUpdate = {
          branch: "main",
          commit_message: "Update GitLab CI/CD configuration",
          actions: [
            {
              action: "update",
              file_path: ".gitlab-ci.yml",
              content: content
            }
          ]
        };
        await axios.post(`${base}/api/v4/projects/${projectId}/repository/commits`, payloadUpdate, { headers: getHeaders() });
        return true;
      } catch (updateErr) {
        console.error("[GitLab] Update .gitlab-ci.yml failed:", updateErr.message);
      }
    }
    console.error("[GitLab] Commit .gitlab-ci.yml failed:", err.response?.data || err.message);
    return false;
  }
}

// Create GitLab Webhook
async function createGitLabWebhook(projectId, webhookUrl) {
  const base = getGitLabBaseUrl();
  if (!hasGitLab()) return { id: 444 };

  const payload = {
    url: webhookUrl,
    push_events: true,
    issues_events: true,
    note_events: true,
    pipeline_events: true,
    enable_ssl_verification: false
  };

  try {
    console.log(`[GitLab] Setting up webhook for project ${projectId} pointing to: ${webhookUrl}`);
    const res = await axios.post(`${base}/api/v4/projects/${projectId}/hooks`, payload, { headers: getHeaders() });
    return res.data;
  } catch (err) {
    console.error(`[GitLab] Webhook configuration failed for project ${projectId}:`, err.response?.data || err.message);
    return { id: 444 };
  }
}

module.exports = {
  createGitLabGroup,
  createGitLabProject,
  createGitLabIssueBoard,
  createGitLabIssue,
  linkGitLabIssues,
  transitionGitLabIssue,
  createGitLabIssueNote,
  getGitLabIssueNotes,
  commitGitLabCIYaml,
  createGitLabWebhook,
  getGitLabBaseUrl
};
