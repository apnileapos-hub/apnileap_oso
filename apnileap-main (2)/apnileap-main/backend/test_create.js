const axios = require("axios");
require("dotenv").config();

const auth = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
).toString("base64");

async function main() {
  try {
    const response = await axios.post(
      `${process.env.JIRA_DOMAIN}/rest/api/3/issue`,
      {
        fields: {
          project: { key: "AK" },
          summary: "Test Label Creation",
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Testing if labels are created" }]
              }
            ]
          },
          issuetype: { name: "Task" },
          labels: ["test-label-spoke"]
        }
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        }
      }
    );
    console.log("Success! Created issue:", response.data.key);
    
    // Now get the issue to see if the label is set
    const getRes = await axios.get(
      `${process.env.JIRA_DOMAIN}/rest/api/3/issue/${response.data.key}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json"
        }
      }
    );
    console.log("Created issue labels:", getRes.data.fields.labels);
  } catch (error) {
    console.error("Error details:", error.response?.data || error.message);
  }
}

main();
