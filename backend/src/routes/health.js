const { pool } = require("../db");
const { asyncRoute } = require("../utils/asyncRoute");

function registerHealthRoutes(app) {
  app.get("/", (_req, res) => {
    res.json({ message: "Schedule backend is running" });
  });

  app.get(
    "/health",
    asyncRoute(async (_req, res) => {
      const result = await pool.query("SELECT NOW()");
      res.json({
        status: "ok",
        database: "connected",
        time: result.rows[0].now,
      });
    }),
  );
}

module.exports = { registerHealthRoutes };
