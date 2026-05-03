const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "schedule_db",
  user: process.env.DB_USER || "schedule_user",
  password: process.env.DB_PASSWORD || "schedule_password",
});

module.exports = { pool };
