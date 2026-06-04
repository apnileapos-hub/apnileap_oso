const db = require('./db');

async function getPassword() {
  try {
    const res = await db.query(
      "SELECT email, name, role, password FROM users WHERE email = $1",
      ['amit.k@kle.edu']
    );
    console.log("=== User Credentials ===");
    console.log(res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

getPassword();
