const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Connection config
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Helper for querying
const query = (text, params) => pool.query(text, params);

// Auto-initialize tables
const initDb = async () => {
  const createTablesQuery = `
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
  `;

  try {
    await query(createTablesQuery);
    // Dynamic database alter schema check to ensure backward compatibility
    await query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS accepted_by VARCHAR(255);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_progress_docs JSONB DEFAULT '[]';
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
              `INSERT INTO projects (id, name, description, budget, duration_weeks, status, company_id, created_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [
                cleanId,
                p.title,
                p.description || '',
                p.funding || 0,
                parseInt(p.duration) || 12,
                p.status.toUpperCase(),
                companyId,
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
  } catch (err) {
    console.error('Failed to initialize PostgreSQL tables:', err.message);
  }
};

initDb();

module.exports = {
  query,
  pool
};
