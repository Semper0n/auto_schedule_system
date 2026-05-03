const { pool } = require("../db");
const { audit } = require("../services/audit");
const { authToken, createAuthResponse, deleteSession } = require("../services/auth");
const { asyncRoute } = require("../utils/asyncRoute");

function registerAuthRoutes(app) {
  app.post(
    "/api/auth/login",
    asyncRoute(async (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Введите логин и пароль" });
      }

      const result = await pool.query(
        "SELECT user_id, username, role FROM users WHERE username = $1 AND crypt($2, password_hash) = password_hash",
        [String(username).trim(), password],
      );
      if (result.rowCount === 0) {
        return res.status(401).json({ error: "Неверный логин или пароль" });
      }
      await audit("login", "users", result.rows[0].user_id);
      return res.json(createAuthResponse(result.rows[0]));
    }),
  );

  app.post(
    "/api/auth/register",
    asyncRoute(async (req, res) => {
      const username = String(req.body.username || "").trim();
      const password = String(req.body.password || "");
      if (username.length < 3) {
        return res.status(400).json({ error: "Логин должен быть не короче 3 символов" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Пароль должен быть не короче 6 символов" });
      }

      try {
        const result = await pool.query(
          "INSERT INTO users (username, password_hash, role) VALUES ($1, crypt($2, gen_salt('bf')), 'user') RETURNING user_id, username, role",
          [username, password],
        );
        await audit("register", "users", result.rows[0].user_id);
        return res.status(201).json(createAuthResponse(result.rows[0]));
      } catch (error) {
        if (error.code === "23505") {
          return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
        }
        throw error;
      }
    }),
  );

  app.post(
    "/api/auth/logout",
    asyncRoute(async (req, res) => {
      const token = authToken(req);
      if (token) {
        deleteSession(token);
      }
      return res.status(204).send();
    }),
  );
}

module.exports = { registerAuthRoutes };
