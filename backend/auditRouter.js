const express = require('express');
const router = express.Router();
const db = require('./db');

// Helper to log system events
async function logAudit({ actor, action, entity, entityId, oldValue = null, newValue = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor, action, entity, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actor, action, entity, entityId, oldValue, newValue]
    );
    console.log(`📝 Audit Log Registered: [${actor}] ${action} on ${entity} (${entityId})`);
  } catch (err) {
    console.error("Failed to write audit log to database:", err.message);
  }
}

// GET: Fetch all audit logs
router.get("/audit-logs", async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

module.exports = {
  router,
  logAudit
};
