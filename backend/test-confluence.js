const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getJiraBase = () => process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";
const getJiraAuth = () => ({
  username: process.env.JIRA_EMAIL,
  password: process.env.JIRA_API_TOKEN,
});

async function testConfluence() {
  const base = getJiraBase();
  const auth = getJiraAuth();
  
  console.log("=== Verification Configuration ===");
  console.log("Atlassian Base URL:", base);
  console.log("Email:", auth.username);
  console.log("==================================");

  if (!auth.username || !auth.password) {
    console.error("Credentials not set in .env!");
    process.exit(1);
  }

  try {
    // Attempt to fetch existing Confluence spaces using the v2 endpoint
    console.log("Fetching spaces from Confluence v2 API...");
    const res = await axios.get(`${base}/wiki/api/v2/spaces`, {
      auth,
      headers: {
        Accept: 'application/json'
      }
    });
    console.log("\n>>> SUCCESS! Confluence spaces fetched.");
    console.log("Spaces:", res.data.results.map(s => ({ id: s.id, key: s.key, name: s.name })));
  } catch (err) {
    console.log("\n>>> Confluence API v2 spaces fetch failed. Trying v1 endpoint...");
    try {
      const res = await axios.get(`${base}/wiki/rest/api/space`, {
        auth,
        headers: {
          Accept: 'application/json'
        }
      });
      console.log("\n>>> SUCCESS! Confluence spaces (v1) fetched.");
      console.log("Spaces:", res.data.results.map(s => ({ id: s.id, key: s.key, name: s.name })));
    } catch (v1Err) {
      console.error("\n>>> FAILED to contact Confluence APIs.");
      console.error("v2 Error status:", err.response?.status, err.response?.data);
      console.error("v1 Error status:", v1Err.response?.status, v1Err.response?.data);
    }
  }
}

testConfluence();
