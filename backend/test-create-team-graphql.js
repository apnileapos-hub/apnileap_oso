const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ORG_ID = '3e8909b9-234a-4def-aaf9-adc97997b269';
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE = process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";

const authBase64 = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

async function testCreateTeamGraphQL() {
  const query = `
    mutation CreateTeam($input: CreateTeamInput!) {
      team {
        create(input: $input) {
          success
          team {
            id
            displayName
          }
          errors {
            message
          }
        }
      }
    }
  `;
  
  const variables = {
    input: {
      organizationId: ORG_ID,
      displayName: "GraphQL API Team",
      description: "Created via GraphQL API"
    }
  };

  try {
    const res = await axios.post(
      `${JIRA_BASE}/gateway/api/graphql`,
      { query, variables },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authBase64}`
        }
      }
    );
    console.log("Success:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}

testCreateTeamGraphQL();

