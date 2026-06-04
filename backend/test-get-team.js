const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ORG_ID = '3e8909b9-234a-4def-aaf9-adc97997b269';
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;

const authBase64 = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

async function testGetTeams() {
  try {
    const res = await axios.get(
      `https://api.atlassian.com/public/teams/v1/org/${ORG_ID}/teams`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${authBase64}`
        }
      }
    );
    console.log("Success GET:", res.data);
  } catch (err) {
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}

testGetTeams();
