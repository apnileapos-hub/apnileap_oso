/**
 * Test user invitation with custom product permissions arrays.
 * Usage: node backend/test-invite-products.js
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

async function testProductsInvite() {
  const base = getJiraBase();
  const auth = getJiraAuth();
  const email = `antigravity-prod-${Math.floor(Math.random() * 10000)}@kle.edu`;
  const name = "Antigravity Product Test User";
  const products = ["jira-software", "confluence"];

  console.log("=== Verification Configuration ===");
  console.log("Jira Site URL:", base);
  console.log("Jira Email:", auth.username);
  console.log("Target User:", email);
  console.log("Selected Products:", JSON.stringify(products));
  console.log("==================================");

  if (!auth.username || !auth.password) {
    console.error("Jira credentials not set in .env!");
    process.exit(1);
  }

  try {
    console.log(`\nSending user invitation request to POST /rest/api/3/user...`);
    const response = await axios.post(
      `${base}/rest/api/3/user`,
      {
        emailAddress: email,
        displayName: name,
        products: products
      },
      { auth, headers: jiraHeaders }
    );

    console.log("\n>>> SUCCESS! User invited successfully.");
    console.log("API Response Data:", JSON.stringify(response.data, null, 2));

  } catch (err) {
    console.error("\n>>> FAILED: Invitation failed.");
    console.error("Status:", err.response?.status);
    console.error("Error Messages:", err.response?.data?.errorMessages || err.response?.data);
    console.error("Message:", err.message);
  }
}

testProductsInvite();
