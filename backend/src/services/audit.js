const { pool } = require("../db");

async function audit(action, entityName, entityId, details = {}) {
  await pool.query(
    "INSERT INTO audit_log (action, entity_name, entity_id, details) VALUES ($1, $2, $3, $4)",
    [action, entityName, entityId || null, details],
  );
}

module.exports = { audit };
