/**
 * Standalone cleanup script to remove all teams.
 * Usage: node backend/clear-all-teams.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function clearAllTeams() {
  console.log("=== Clearing All Teams ===");
  
  // 1. Overwrite teams.json with empty array
  const teamsFilePath = path.join(__dirname, 'teams.json');
  try {
    fs.writeFileSync(teamsFilePath, '[]', 'utf8');
    console.log("✔ Cleared teams.json successfully!");
  } catch (err) {
    console.error("❌ Failed to clear teams.json:", err.message);
  }

  // 2. Connect to PostgreSQL and clear the teams table
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not set in backend/.env. Skipping database cleanup.");
    return;
  }

  console.log("Connecting to PostgreSQL...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Required for Render SSL connections
  });

  try {
    await client.connect();
    
    console.log("Truncating teams table...");
    // DELETE FROM teams will automatically CASCADE to team_messages (ON DELETE CASCADE)
    const res = await client.query('DELETE FROM teams');
    
    console.log(`✔ PostgreSQL 'teams' table cleared successfully! Affected rows: ${res.rowCount}`);

    // If there is any project_teams table, we clear it too
    try {
      const resPT = await client.query('DELETE FROM project_teams');
      console.log(`✔ PostgreSQL 'project_teams' table cleared! Affected rows: ${resPT.rowCount}`);
    } catch (ptErr) {
      console.log(`(Note: project_teams query bypass: ${ptErr.message})`);
    }

    // Clear team_id references in projects table
    try {
      const resProj = await client.query('UPDATE projects SET team_id = NULL');
      console.log(`✔ Cleared team associations in projects table! Affected rows: ${resProj.rowCount}`);
    } catch (projErr) {
      console.log(`(Note: projects update bypass: ${projErr.message})`);
    }

  } catch (dbErr) {
    console.error("❌ PostgreSQL cleanup failed:", dbErr.message);
  } finally {
    await client.end();
    console.log("PostgreSQL connection closed.");
  }
}

clearAllTeams();
