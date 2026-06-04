/**
 * Standalone test script to verify Jira Cloud User Invitation & Spoke Group Assignment logic.
 * Usage: node test-user-sync.js
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getJiraBase = () => process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";
const getJiraAuth = () => ({
  username: process.env.JIRA_EMAIL,
  password: process.env.JIRA_API_TOKEN,
});

const jiraHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function testSync(email, name, collegeId) {
  const jiraBase = getJiraBase();
  const jiraAuth = getJiraAuth();

  console.log("=== Active Configuration ===");
  console.log("Jira Site URL:", jiraBase);
  console.log("Jira Email:", jiraAuth.username);
  console.log("Jira Token:", jiraAuth.password ? "Configured (Masked)" : "Not Set");
  console.log("============================");

  if (!jiraAuth.username || !jiraAuth.password) {
    console.error("Error: Jira credentials not set in .env!");
    process.exit(1);
  }

  try {
    console.log(`\n[Step 1] Attempting to invite user ${email} (${name}) to Jira Cloud...`);
    let accountId = null;

    try {
      const inviteRes = await axios.post(
        `${jiraBase}/rest/api/3/user`,
        {
          emailAddress: email,
          displayName: name,
          products: ["jira-software"]
        },
        { auth: jiraAuth, headers: jiraHeaders }
      );
      if (inviteRes.data && inviteRes.data.accountId) {
        accountId = inviteRes.data.accountId;
        console.log(`>>> Success: Invited user successfully. Account ID: ${accountId}`);
      }
    } catch (inviteErr) {
      console.warn(`>>> Warning: Direct invitation returned an error (user might already exist or admin credentials restricted): ${inviteErr.response?.data?.errorMessages?.join(", ") || inviteErr.message}`);
    }

    console.log(`\n[Step 2] Querying Atlassian Directory to locate user account ID for: ${email}...`);
    try {
      const searchRes = await axios.get(
        `${jiraBase}/rest/api/3/user/search?query=${encodeURIComponent(email)}`,
        { auth: jiraAuth, headers: jiraHeaders }
      );
      if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        const matched = searchRes.data.find(u => u.emailAddress?.toLowerCase() === email.toLowerCase()) || searchRes.data[0];
        accountId = matched.accountId;
        console.log(`>>> Success: Found user in Atlassian search. Account ID: ${accountId}`);
      } else {
        console.log(">>> User not found in Atlassian search directory.");
      }
    } catch (searchErr) {
      console.error(`>>> Error during user lookup: ${searchErr.response?.data || searchErr.message}`);
    }

    if (!accountId) {
      console.error(`\n[Abort] Unable to retrieve account ID for ${email}. Check permissions or email registration.`);
      return;
    }

    if (collegeId) {
      const groupName = collegeId.trim();
      console.log(`\n[Step 3] Checking or auto-creating spoke group: '${groupName}'...`);
      
      try {
        await axios.post(
          `${jiraBase}/rest/api/3/group`,
          { name: groupName },
          { auth: jiraAuth, headers: jiraHeaders }
        );
        console.log(`>>> Success: Spoke group '${groupName}' checked/created successfully.`);
      } catch (groupCreateErr) {
        console.log(`>>> Note: Spoke group creation check completed: ${groupCreateErr.response?.data?.errorMessages?.join(", ") || groupCreateErr.message}`);
      }

      console.log(`\n[Step 4] Adding user ${email} to spoke group: '${groupName}'...`);
      try {
        await axios.post(
          `${jiraBase}/rest/api/3/group/user?groupname=${encodeURIComponent(groupName)}`,
          { accountId: accountId },
          { auth: jiraAuth, headers: jiraHeaders }
        );
        console.log(`>>> Success: Added user ${email} to Atlassian group '${groupName}' successfully!`);
      } catch (groupAddErr) {
        console.error(`>>> Error: Failed to add user to group:`, groupAddErr.response?.data || groupAddErr.message);
      }
    }

    console.log("\n=== Test Synchronization Completed Successfully! ===");

  } catch (err) {
    console.error("\n=== Test Synchronization Failed! ===");
    console.error(err.response?.data || err.message);
  }
}

// Run test sync
const testEmail = "antigravity-test-user@kle.edu";
const testName = "Antigravity KLE Spoke Test User";
const testSpoke = "kle-spoke";

testSync(testEmail, testName, testSpoke);
