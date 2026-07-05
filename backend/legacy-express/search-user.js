const db = require('./db');

async function searchUser() {
  try {
    const res = await db.query(
      "SELECT id, email, name, role, college_id as \"collegeId\" FROM users WHERE email LIKE $1 OR name LIKE $2",
      ['%amit%', '%Amit%']
    );
    console.log("=== Matching Users in Database ===");
    console.log(res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

searchUser();
