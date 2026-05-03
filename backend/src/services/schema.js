const { ownedTables } = require("../config/constants");
const { pool } = require("../db");

async function ensureOwnershipSchema() {
  const admin = await pool.query(
    "INSERT INTO users (username, password_hash, role) VALUES ('admin', crypt('admin', gen_salt('bf')), 'admin') ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username RETURNING user_id",
  );
  const adminId = admin.rows[0].user_id;

  for (const table of ownedTables) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE`);
    await pool.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [adminId]);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id)`);
  }

  await pool.query("DROP INDEX IF EXISTS idx_semesters_one_active");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_semesters_user_one_active ON semesters(user_id) WHERE is_active = TRUE");
  await pool.query("ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_user_name ON departments(user_id, name)");
  await pool.query("ALTER TABLE student_groups DROP CONSTRAINT IF EXISTS student_groups_name_key");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_student_groups_user_name ON student_groups(user_id, name)");
  await pool.query("ALTER TABLE lesson_types DROP CONSTRAINT IF EXISTS lesson_types_name_key");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_types_user_name ON lesson_types(user_id, name)");
  await pool.query("ALTER TABLE buildings DROP CONSTRAINT IF EXISTS buildings_name_key");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_user_name ON buildings(user_id, name)");
  await pool.query("ALTER TABLE classrooms DROP CONSTRAINT IF EXISTS classrooms_building_id_name_key");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_classrooms_user_building_name ON classrooms(user_id, building_id, name)");
  await pool.query("ALTER TABLE time_slots DROP CONSTRAINT IF EXISTS time_slots_day_of_week_pair_number_key");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_time_slots_user_day_pair ON time_slots(user_id, day_of_week, pair_number)");
}

module.exports = { ensureOwnershipSchema };
