const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getJiraBase = () => process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";
const getJiraAuth = () => ({
  username: process.env.JIRA_EMAIL,
  password: process.env.JIRA_API_TOKEN,
});

async function diagnostic() {
  const jiraBase = getJiraBase();
  const jiraAuth = getJiraAuth();

  console.log("=== Diagnostics ===");
  console.log("Jira Site URL:", jiraBase);
  console.log("Jira Email:", jiraAuth.username);
  console.log("====================");

  try {
    const res = await axios.get(`${jiraBase}/rest/api/3/myself`, {
      auth: jiraAuth,
      headers: { Accept: "application/json" }
    });
    console.log("Success! Authenticated user account details:");
    console.log("Display Name:", res.data.displayName);
    console.log("Account ID:", res.data.accountId);
    console.log("Email Address:", res.data.emailAddress);
  } catch (err) {
    console.error("Authentication check failed!");
    console.error("Status Code:", err.response?.status);
    console.error("Error Message:", err.response?.data || err.message);
  }
}

diagnostic();
