const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const isProduction = process.env.NODE_ENV === 'production';

// Connection config
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: (isProduction || (connectionString && connectionString.includes('render.com'))) ? { rejectUnauthorized: false } : false
});

// Helper for querying
const query = (text, params) => pool.query(text, params);

// Auto-initialize tables
const initDb = async () => {
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS calls_store (
      id INT PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id VARCHAR(255) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      campus_id VARCHAR(255) NOT NULL,
      date VARCHAR(50) NOT NULL,
      time VARCHAR(50) NOT NULL,
      link TEXT NOT NULL,
      agenda TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      task_id VARCHAR(255) NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      comments TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mock_tasks (
      id VARCHAR(255) PRIMARY KEY,
      key VARCHAR(255) UNIQUE,
      board_id VARCHAR(255) NOT NULL,
      fields JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      logo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS universities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS colleges (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      university_id INT REFERENCES universities(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      skills_required TEXT[],
      budget DECIMAL(12, 2) NOT NULL,
      duration_weeks INT NOT NULL,
      status VARCHAR(50) DEFAULT 'DRAFT',
      company_id INT REFERENCES companies(id) ON DELETE SET NULL,
      confluence_space_url TEXT,
      jira_board_url TEXT,
      created_by VARCHAR(255),
      accepted_by VARCHAR(255),
      work_progress_docs JSONB DEFAULT '[]',
      spoke_id VARCHAR(100),
      team_id VARCHAR(100),
      epics JSONB DEFAULT '[]',
      reminders JSONB DEFAULT '[]',
      jira_project_key VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_assignments (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      college_id INT REFERENCES colleges(id) ON DELETE SET NULL,
      faculty_id INT,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_teams (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      lead_id INT,
      members INT[]
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      repo_name VARCHAR(255) NOT NULL UNIQUE,
      repo_url TEXT NOT NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INT REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor VARCHAR(255) NOT NULL,
      action VARCHAR(255) NOT NULL,
      entity VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100),
      old_value JSONB,
      new_value JSONB,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL,
      password VARCHAR(255) NOT NULL DEFAULT 'Admin@123',
      college_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meeting_messages (
      id SERIAL PRIMARY KEY,
      meeting_id VARCHAR(255) REFERENCES meetings(id) ON DELETE CASCADE,
      sender VARCHAR(255) NOT NULL,
      text TEXT NOT NULL,
      issue_key VARCHAR(255),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      members TEXT[] DEFAULT '{}',
      college_id VARCHAR(50),
      project_id BIGINT
    );

    CREATE TABLE IF NOT EXISTS team_messages (
      id VARCHAR(255) PRIMARY KEY,
      team_id VARCHAR(255) REFERENCES teams(id) ON DELETE CASCADE,
      sender VARCHAR(255) NOT NULL,
      text TEXT NOT NULL,
      issue_key VARCHAR(255),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await query(createTablesQuery);
    // Dynamic database alter schema check to ensure backward compatibility
    await query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS accepted_by VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_progress_docs JSONB DEFAULT '[]';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS spoke_id VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id VARCHAR(100);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS epics JSONB DEFAULT '[]';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS reminders JSONB DEFAULT '[]';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS jira_project_key VARCHAR(100);
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS college_id VARCHAR(50);
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS project_id BIGINT;
    `);
    console.log('PostgreSQL tables initialized successfully!');

    // Seed default users if empty
    const userCount = await query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      await query(`
        INSERT INTO users (email, name, role, password, college_id) VALUES
        ('admin@devcobra.io', 'Admin', 'Admin', 'Admin@123', NULL),
        ('moderator@apnileap.com', 'Super Admin', 'Super-admin', 'Vanyx@1512', NULL),
        ('spoc-kle@college.edu', 'KLE SPOC', 'College-SPOC', 'Admin@123', 'kle-spoke'),
        ('spoc-coep@college.edu', 'COEP SPOC', 'College-SPOC', 'Admin@123', 'coep-spoke'),
        ('spoc-mmcoep@college.edu', 'MMCOEP SPOC', 'College-SPOC', 'Admin@123', 'mmcoep-spoke'),
        ('spoc-rit@college.edu', 'RIT SPOC', 'College-SPOC', 'Admin@123', 'rit-spoke')
      `);
      console.log('PostgreSQL users table seeded with initial users.');
    }

    // Ensure the 5 real Atlassian users exist in the users table
    await query(`
      INSERT INTO users (email, name, role, password, college_id) VALUES
      ('apnileapos@gmail.com', 'apnileapos', 'Student', 'Admin@123', 'kle-spoke'),
      ('renuka.k@college.edu', 'Renuka Kagadal', 'Student', 'Admin@123', 'kle-spoke'),
      ('ananya.b@college.edu', 'Ananya Bhat', 'Student', 'Admin@123', 'kle-spoke'),
      ('divya.k@college.edu', 'Divya Kumari', 'Student', 'Admin@123', 'kle-spoke'),
      ('manasa.v@college.edu', 'Manasa B Vasare', 'Student', 'Admin@123', 'kle-spoke')
      ON CONFLICT (email) DO NOTHING
    `);
    console.log('Ensured 5 real Atlassian users exist in PostgreSQL.');

    // Seed the 10 demo Quick Connect accounts in the users table
    await query(`
      INSERT INTO users (email, name, role, password, college_id) VALUES
      ('admin@apnileap.com', 'Executive Admin', 'Admin', 'moderator123', NULL),
      ('moderator@apnileap.com', 'Central Moderator', 'Super-admin', 'moderator123', NULL),
      ('coordinator@kle.edu', 'KLE Mentor', 'College-SPOC', 'kle123', 'kle-spoke'),
      ('coordinator@coep.edu', 'COEP Mentor', 'College-SPOC', 'coep123', 'coep-spoke'),
      ('coordinator@mmcoep.edu', 'MMCOEP Mentor', 'College-SPOC', 'mmcoep123', 'mmcoep-spoke'),
      ('coordinator@rit.edu', 'RIT Mentor', 'College-SPOC', 'rit123', 'rit-spoke'),
      ('sponsor@nvidia.com', 'NVIDIA Sponsor', 'Sponsor', 'nvidia123', NULL),
      ('student@kle.edu', 'KLE Student', 'Student', 'student123', 'kle-spoke'),
      ('student@coep.edu', 'COEP Student', 'Student', 'student123', 'coep-spoke'),
      ('student@rit.edu', 'RIT Student', 'Student', 'student123', 'rit-spoke')
      ON CONFLICT (email) DO UPDATE 
      SET password = EXCLUDED.password, role = EXCLUDED.role, college_id = EXCLUDED.college_id
    `);
    console.log('PostgreSQL users table updated with Quick Connect demo accounts.');


    // Seed projects from projects.json to PostgreSQL
    const projCount = await query('SELECT COUNT(*) FROM projects');
    if (parseInt(projCount.rows[0].count) === 0) {
      const fs = require('fs');
      const path = require('path');
      const projectsFile = path.join(__dirname, 'projects.json');
      if (fs.existsSync(projectsFile)) {
        try {
          const raw = fs.readFileSync(projectsFile, 'utf8');
          const fileProjects = JSON.parse(raw);
          for (const p of fileProjects) {
            let companyId = null;
            if (p.company) {
              const compRes = await query('SELECT id FROM companies WHERE name = $1', [p.company]);
              if (compRes.rows.length > 0) {
                companyId = compRes.rows[0].id;
              } else {
                const compIns = await query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [p.company]);
                companyId = compIns.rows[0].id;
              }
            }
            const cleanId = parseInt(p.id.replace('proj-', '')) || Math.floor(Math.random() * 100000);
            await query(
              `INSERT INTO projects (id, name, description, budget, duration_weeks, status, company_id, spoke_id, team_id, epics, reminders, jira_project_key, created_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (id) DO NOTHING`,
              [
                cleanId,
                p.title,
                p.description || '',
                p.funding || 0,
                parseInt(p.duration) || 12,
                p.status.toUpperCase(),
                companyId,
                p.spokeId || null,
                p.teamId || null,
                JSON.stringify(p.epics || []),
                JSON.stringify(p.reminders || []),
                p.jiraProjectKey || null,
                p.createdAt ? new Date(p.createdAt) : new Date()
              ]
            );
          }
          console.log('Seeded projects from projects.json into PostgreSQL!');
        } catch (seedErr) {
          console.error('Failed to seed projects:', seedErr.message);
        }
      }
    }

    // Seed teams from teams.json to PostgreSQL
    const teamCount = await query('SELECT COUNT(*) FROM teams');
    if (parseInt(teamCount.rows[0].count) === 0) {
      const fs = require('fs');
      const path = require('path');
      const teamsFile = path.join(__dirname, 'teams.json');
      if (fs.existsSync(teamsFile)) {
        try {
          const raw = fs.readFileSync(teamsFile, 'utf8');
          const fileTeams = JSON.parse(raw);
          for (const t of fileTeams) {
            await query(
              `INSERT INTO teams (id, name, members) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
              [t.id, t.name, t.members || []]
            );
            if (t.messages && Array.isArray(t.messages)) {
              for (const m of t.messages) {
                const msgId = m.id || "msg-" + Date.now() + Math.random().toString(36).substr(2, 5);
                await query(
                  `INSERT INTO team_messages (id, team_id, sender, text, issue_key, timestamp) 
                   VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
                  [
                    msgId,
                    t.id,
                    m.sender || 'Unknown',
                    m.text || '',
                    m.issueKey || null,
                    m.timestamp ? new Date(m.timestamp) : new Date()
                  ]
                );
              }
            }
          }
          console.log('Seeded teams from teams.json into PostgreSQL!');
        } catch (seedErr) {
          console.error('Failed to seed teams:', seedErr.message);
        }
      }
    }
  } catch (err) {
    console.error('Failed to initialize PostgreSQL tables:', err.message);
  }
};

initDb();

module.exports = {
  query,
  pool
};
