const { pool } = require("../db");
const { audit } = require("./audit");
const { isTruthy } = require("../utils/data");

async function createSemester(data, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isTruthy(data.is_active)) {
      await client.query("UPDATE semesters SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE", [userId]);
    }

    data.user_id = userId;
    const columns = Object.keys(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const result = await client.query(
      `INSERT INTO semesters (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      Object.values(data),
    );
    await audit("create", "semesters", result.rows[0].semester_id, data);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateSemester(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isTruthy(data.is_active)) {
      await client.query("UPDATE semesters SET is_active = FALSE WHERE user_id = $1 AND semester_id <> $2", [
        userId,
        id,
      ]);
    }

    const columns = Object.keys(data);
    const setClause = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
    const result = await client.query(
      `UPDATE semesters SET ${setClause} WHERE semester_id = $${columns.length + 1} AND user_id = $${columns.length + 2} RETURNING *`,
      [...Object.values(data), id, userId],
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await audit("update", "semesters", result.rows[0].semester_id, data);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createSemester, updateSemester };
