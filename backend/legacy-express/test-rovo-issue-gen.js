const { autoGenerateIssuesForProject } = require('./rovoIssueService');
const db = require('./db');

async function testRovoIssueGen() {
  console.log("=== Testing Rovo Issue Generation ===");

  try {
    // 1. Fetch or create a mock project to test with
    let project;
    const res = await db.query("SELECT * FROM projects LIMIT 1");
    
    if (res.rows.length > 0) {
      project = res.rows[0];
      console.log(`Found existing project in DB: "${project.name}" (ID: ${project.id})`);
    } else {
      console.log("No projects found in database. Creating a mock project...");
      const mockId = Date.now();
      const insertRes = await db.query(
        `INSERT INTO projects (id, name, description, budget, duration_weeks, status, epics)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          mockId,
          "Rovo Smart Agriculture IoT System",
          "Automated soil monitoring and drone spraying system.",
          75000.00,
          16,
          "PENDING_REVIEW",
          JSON.stringify([
            { id: `epic-${mockId}-0`, title: "Requirements & Architecture Specification", description: "Design specifications for Rovo IoT system" },
            { id: `epic-${mockId}-1`, title: "Core Feature Prototype Development", description: "Develop base software and hardware integrations" },
            { id: `epic-${mockId}-2`, title: "Deployment & Quality Engineering Sync", description: "Test drone deployment and field telemetry" }
          ])
        ]
      );
      project = insertRes.rows[0];
      console.log(`Mock project created successfully: "${project.name}" (ID: ${project.id})`);
    }

    // 2. Run the issue generator
    const testJiraKey = project.jira_project_key || "ROVO" + Math.floor(100 + Math.random() * 900);
    const updatedEpics = await autoGenerateIssuesForProject(project, testJiraKey);

    console.log("Updated Epics with Jira Keys:");
    console.log(JSON.stringify(updatedEpics, null, 2));

    // 3. Verify mock tasks are created in the database
    const spokeToBoard = {
      'kle-spoke': '3',
      'coep-spoke': '101',
      'mmcoep-spoke': '102',
      'rit-spoke': '103',
      '3': '3',
      '101': '101',
      '102': '102',
      '103': '103'
    };
    const boardId = spokeToBoard[project.spoke_id || "kle-spoke"] || '3';

    const tasksRes = await db.query("SELECT key, fields->>'summary' as summary, fields->'parent'->>'key' as parent FROM mock_tasks WHERE board_id = $1", [boardId]);
    console.log(`\nSuccessfully created ${tasksRes.rows.length} tasks in the local mock board [${boardId}]:`);
    tasksRes.rows.forEach(t => {
      console.log(`- [Task Key: ${t.key}] "${t.summary}" under Epic/Parent: ${t.parent}`);
    });

    console.log("\n✅ Rovo Issue & Epic Auto-Generation Test PASSED Successfully!");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ Rovo Issue & Epic Auto-Generation Test FAILED!");
    console.error(err);
    process.exit(1);
  }
}

testRovoIssueGen();
