const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JIRA_DOMAIN = 'https://manasa-kle-apnileap.atlassian.net';
const auth = Buffer.from(
  process.env.JIRA_API_TOKEN || ''
).toString('base64');

const headers = {
  Authorization: 'Basic ' + auth,
  'Content-Type': 'application/json',
};

const ALLOCATION_ID = '78b50b88-0bcd-4808-b91e-e22ceb0ecf07';

async function run() {
  try {
    // Step 1: Create Epic in Jira for "new project"
    console.log('Step 1: Creating Epic in Jira...');
    const epicRes = await axios.post(
      `${JIRA_DOMAIN}/rest/api/2/issue`,
      {
        fields: {
          project: { key: 'AK' },
          summary: 'new project',
          description: 'Epic for new project assigned to KLE Spoke',
          issuetype: { name: 'Epic' },
          customfield_10011: 'new project',
          labels: ['kle-spoke'],
        },
      },
      { headers, timeout: 30000 }
    );

    const epicKey = epicRes.data.key;
    console.log('  Created Epic:', epicKey);

    // Step 2: Update the Postgres allocation with the new Epic key
    console.log('Step 2: Updating allocation in Postgres...');
    await prisma.allocation.update({
      where: { id: ALLOCATION_ID },
      data: { jiraEpicKey: epicKey },
    });
    console.log('  Updated allocation jiraEpicKey to:', epicKey);

    // Step 3: Create Phase 1 task under the Epic
    console.log('Step 3: Creating Phase 1 task...');
    const taskRes = await axios.post(
      `${JIRA_DOMAIN}/rest/api/2/issue`,
      {
        fields: {
          project: { key: 'AK' },
          summary: 'Phase 1: Deep Learning Infrastructure Provisioning',
          description: 'Phase 1 setup task for the new project.',
          issuetype: { name: 'Task' },
          parent: { key: epicKey },
          labels: ['kle-spoke'],
        },
      },
      { headers, timeout: 30000 }
    );
    console.log('  Created Phase 1 Task:', taskRes.data.key);

    console.log('\nDone! Epic', epicKey, 'with Phase 1 task', taskRes.data.key, 'created successfully.');
  } catch (e) {
    if (e.response) {
      console.error('Jira API Error:', e.response.status, JSON.stringify(e.response.data, null, 2));
    } else {
      console.error('Error:', e.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

run();
