const { weekDays } = require("../config/constants");
const { pool } = require("../db");
const { audit } = require("../services/audit");
const { asyncRoute } = require("../utils/asyncRoute");

function registerTimeSlotTemplateRoutes(app) {
  app.post(
    "/api/timeSlotTemplates",
    asyncRoute(async (req, res) => {
      const { pair_number, starts_at, ends_at } = req.body;
      if (!pair_number || !starts_at || !ends_at) {
        return res.status(400).json({ error: "Missing pair_number, starts_at or ends_at" });
      }

      const values = [];
      const placeholders = weekDays
        .map((day, index) => {
          values.push(req.user.user_id, day, pair_number, starts_at, ends_at);
          const offset = index * 5;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
        })
        .join(", ");

      const result = await pool.query(
        `INSERT INTO time_slots (user_id, day_of_week, pair_number, starts_at, ends_at)
         VALUES ${placeholders}
         ON CONFLICT (user_id, day_of_week, pair_number)
         DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at
         RETURNING *`,
        values,
      );
      await audit("upsert", "time_slot_templates", pair_number, { pair_number, starts_at, ends_at });
      return res.status(201).json(result.rows);
    }),
  );

  app.put(
    "/api/timeSlotTemplates/:pairNumber",
    asyncRoute(async (req, res) => {
      const { pair_number, starts_at, ends_at } = req.body;
      if (!pair_number || !starts_at || !ends_at) {
        return res.status(400).json({ error: "Missing pair_number, starts_at or ends_at" });
      }

      const result = await pool.query(
        `UPDATE time_slots
         SET pair_number = $1, starts_at = $2, ends_at = $3
         WHERE pair_number = $4 AND user_id = $5
         RETURNING *`,
        [pair_number, starts_at, ends_at, req.params.pairNumber, req.user.user_id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Time slot template not found" });
      }
      await audit("update", "time_slot_templates", req.params.pairNumber, { pair_number, starts_at, ends_at });
      return res.json(result.rows);
    }),
  );

  app.delete(
    "/api/timeSlotTemplates/:pairNumber",
    asyncRoute(async (req, res) => {
      const result = await pool.query("DELETE FROM time_slots WHERE pair_number = $1 AND user_id = $2 RETURNING *", [
        req.params.pairNumber,
        req.user.user_id,
      ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Time slot template not found" });
      }
      await audit("delete", "time_slot_templates", req.params.pairNumber, result.rows);
      return res.status(204).send();
    }),
  );
}

module.exports = { registerTimeSlotTemplateRoutes };
