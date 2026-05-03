const { pool } = require("../db");
const { audit } = require("../services/audit");
const { createSemester, updateSemester } = require("../services/semesters");
const { asyncRoute } = require("../utils/asyncRoute");
const { pickColumns } = require("../utils/data");

function registerCrudRoutes(app, name, config) {
  app.get(
    `/api/${name}`,
    asyncRoute(async (req, res) => {
      const result = config.owned
        ? await pool.query(`SELECT * FROM ${config.table} WHERE user_id = $1 ORDER BY ${config.id}`, [
            req.user.user_id,
          ])
        : await pool.query(`SELECT * FROM ${config.table} ORDER BY ${config.id}`);
      res.json(result.rows);
    }),
  );

  app.post(
    `/api/${name}`,
    asyncRoute(async (req, res) => {
      const data = pickColumns(req.body, config.columns);
      let columns = Object.keys(data);
      if (columns.length === 0) {
        return res.status(400).json({ error: "Нет данных для создания записи" });
      }

      if (name === "semesters") {
        const row = await createSemester(data, req.user.user_id);
        return res.status(201).json(row);
      }

      if (config.owned) {
        data.user_id = req.user.user_id;
        columns = Object.keys(data);
      }
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        Object.values(data),
      );
      await audit("create", config.table, result.rows[0][config.id], data);
      return res.status(201).json(result.rows[0]);
    }),
  );

  app.put(
    `/api/${name}/:id`,
    asyncRoute(async (req, res) => {
      const data = pickColumns(req.body, config.columns);
      const columns = Object.keys(data);
      if (columns.length === 0) {
        return res.status(400).json({ error: "Нет данных для обновления записи" });
      }

      if (name === "semesters") {
        const row = await updateSemester(req.params.id, data, req.user.user_id);
        if (!row) {
          return res.status(404).json({ error: "Запись не найдена" });
        }
        return res.json(row);
      }

      const setClause = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
      const result = config.owned
        ? await pool.query(
            `UPDATE ${config.table} SET ${setClause} WHERE ${config.id} = $${columns.length + 1} AND user_id = $${columns.length + 2} RETURNING *`,
            [...Object.values(data), req.params.id, req.user.user_id],
          )
        : await pool.query(
            `UPDATE ${config.table} SET ${setClause} WHERE ${config.id} = $${columns.length + 1} RETURNING *`,
            [...Object.values(data), req.params.id],
          );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Запись не найдена" });
      }
      await audit("update", config.table, result.rows[0][config.id], data);
      return res.json(result.rows[0]);
    }),
  );

  app.delete(
    `/api/${name}/:id`,
    asyncRoute(async (req, res) => {
      const result = config.owned
        ? await pool.query(`DELETE FROM ${config.table} WHERE ${config.id} = $1 AND user_id = $2 RETURNING *`, [
            req.params.id,
            req.user.user_id,
          ])
        : await pool.query(`DELETE FROM ${config.table} WHERE ${config.id} = $1 RETURNING *`, [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Запись не найдена" });
      }
      await audit("delete", config.table, result.rows[0][config.id], result.rows[0]);
      return res.status(204).send();
    }),
  );
}

module.exports = { registerCrudRoutes };
