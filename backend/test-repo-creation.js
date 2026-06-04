/**
 * Test GitHub repository creation diagnostic.
 * Usage: node backend/test-repo-creation.js
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testRepoCreation() {
  const token = process.env.GITHUB_TOKEN;
  const org = process.env.GITHUB_ORG || 'apnileapos-hub';
  const repoName = `apnileap-test-diagnostic-${Math.floor(Math.random() * 10000)}`;

  console.log("=== Repository Creation Diagnostic ===");
  console.log("GitHub Token:", token ? "Configured (Masked)" : "Not Set");
  console.log("GitHub Org Config:", org);
  console.log("Target Repo Name:", repoName);
  console.log("======================================");

  if (!token) {
    console.error("GITHUB_TOKEN not found in backend/.env!");
    process.exit(1);
  }

  let createUrl = 'https://api.github.com/user/repos';
  let isOrg = false;
  
  if (org) {
    createUrl = `https://api.github.com/orgs/${org}/repos`;
    isOrg = true;
  }

  try {
    console.log(`\n[Attempt 1] Attempting to create repo under org endpoint: ${createUrl}...`);
    const res = await axios.post(
      createUrl,
      {
        name: repoName,
        description: "Automated test repository",
        private: true,
        auto_init: true
      },
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'APNILEAP-App-Diagnostic'
        }
      }
    );
    console.log("✅ Success! Created under Org endpoint.");
    console.log("HTML URL:", res.data.html_url);

  } catch (orgErr) {
    console.log(`❌ Org endpoint failed. Status: ${orgErr.response?.status}`);
    console.log("Error details:", orgErr.response?.data || orgErr.message);

    if (isOrg && (orgErr.response?.status === 404 || orgErr.response?.status === 403)) {
      console.log(`\n[Attempt 2] Falling back to personal user repos endpoint: https://api.github.com/user/repos...`);
      try {
        const res = await axios.post(
          'https://api.github.com/user/repos',
          {
            name: repoName,
            description: "Automated test repository fallback",
            private: true,
            auto_init: true
          },
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'APNILEAP-App-Diagnostic'
            }
          }
        );
        console.log("✅ Success! Created under personal user endpoint.");
        console.log("HTML URL:", res.data.html_url);
      } catch (fallbackErr) {
        console.error("❌ Personal endpoint failed too.");
        console.error("Status:", fallbackErr.response?.status);
        console.error("Error details:", fallbackErr.response?.data || fallbackErr.message);
      }
    }
  }
}

testRepoCreation();
