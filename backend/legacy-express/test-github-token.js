const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function verifyGithubToken() {
  console.log("=== Testing GitHub Token Authentication ===");

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("❌ GITHUB_TOKEN not found in backend/.env!");
    process.exit(1);
  }

  try {
    // 1. Get authenticated user
    console.log("Fetching authenticated user profile...");
    const userRes = await axios.get("https://api.github.com/user", {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'APNILEAP-Diagnostic'
      }
    });

    console.log(`Success! Authenticated as: ${userRes.data.login} (${userRes.data.name || 'No Name'})`);

    // 2. Get organizations
    console.log("Fetching user organization memberships...");
    const orgsRes = await axios.get("https://api.github.com/user/orgs", {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'APNILEAP-Diagnostic'
      }
    });

    console.log(`Found ${orgsRes.data.length} organization(s):`);
    orgsRes.data.forEach(org => {
      console.log(`- ${org.login} (ID: ${org.id}, URL: ${org.html_url})`);
    });

    console.log("\n✅ User and Organization details retrieved successfully!");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ GitHub Token Verification FAILED!");
    console.error("Status:", err.response?.status);
    console.error("Error Details:", err.response?.data || err.message);
    process.exit(1);
  }
}

verifyGithubToken();
