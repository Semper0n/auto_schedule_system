const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "schedule_db",
  user: process.env.DB_USER || "schedule_user",
  password: process.env.DB_PASSWORD || "schedule_password",
});

const dayNames = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
};

const weekDays = [1, 2, 3, 4, 5, 6];
const sessions = new Map();
const ownedTables = [
  "semesters",
  "departments",
  "teachers",
  "student_groups",
  "subjects",
  "lesson_types",
  "buildings",
  "classrooms",
  "time_slots",
  "teaching_assignments",
  "teacher_unavailability",
  "group_unavailability",
  "classroom_unavailability",
  "teacher_preferences",
  "schedule_versions",
];

const resources = {
  departments: {
    id: "department_id",
    table: "departments",
    columns: ["name"],
    owned: true,
  },
  semesters: {
    id: "semester_id",
    table: "semesters",
    columns: ["name", "starts_on", "ends_on", "is_active"],
    owned: true,
  },
  teachers: {
    id: "teacher_id",
    table: "teachers",
    columns: ["department_id", "full_name", "position", "max_hours_per_week", "notes"],
    owned: true,
  },
  groups: {
    id: "group_id",
    table: "student_groups",
    columns: ["department_id", "name", "course", "students_count"],
    owned: true,
  },
  subjects: {
    id: "subject_id",
    table: "subjects",
    columns: ["department_id", "name", "total_hours"],
    owned: true,
  },
  lessonTypes: {
    id: "lesson_type_id",
    table: "lesson_types",
    columns: ["name"],
    owned: true,
  },
  buildings: {
    id: "building_id",
    table: "buildings",
    columns: ["name", "address"],
    owned: true,
  },
  classrooms: {
    id: "classroom_id",
    table: "classrooms",
    columns: ["building_id", "name", "capacity", "equipment"],
    owned: true,
  },
  timeSlots: {
    id: "time_slot_id",
    table: "time_slots",
    columns: ["day_of_week", "pair_number", "starts_at", "ends_at"],
    owned: true,
  },
  assignments: {
    id: "assignment_id",
    table: "teaching_assignments",
    columns: [
      "semester_id",
      "teacher_id",
      "subject_id",
      "group_id",
      "lesson_type_id",
      "hours_per_week",
      "classroom_capacity_required",
    ],
    owned: true,
  },
  teacherUnavailability: {
    id: "unavailable_id",
    table: "teacher_unavailability",
    columns: ["teacher_id", "time_slot_id", "reason"],
    owned: true,
  },
  groupUnavailability: {
    id: "unavailable_id",
    table: "group_unavailability",
    columns: ["group_id", "time_slot_id", "reason"],
    owned: true,
  },
  classroomUnavailability: {
    id: "unavailable_id",
    table: "classroom_unavailability",
    columns: ["classroom_id", "time_slot_id", "reason"],
    owned: true,
  },
  teacherPreferences: {
    id: "preference_id",
    table: "teacher_preferences",
    columns: ["teacher_id", "time_slot_id", "preference", "weight"],
    owned: true,
  },
};

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function pickColumns(body, columns) {
  return columns.reduce((acc, column) => {
    if (Object.prototype.hasOwnProperty.call(body, column)) {
      acc[column] = body[column] === "" ? null : body[column];
    }
    return acc;
  }, {});
}

function isTruthy(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

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

async function audit(action, entityName, entityId, details = {}) {
  await pool.query(
    "INSERT INTO audit_log (action, entity_name, entity_id, details) VALUES ($1, $2, $3, $4)",
    [action, entityName, entityId || null, details],
  );
}

function publicUser(row) {
  return {
    user_id: row.user_id,
    username: row.username,
    role: row.role,
  };
}

function createAuthResponse(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const safeUser = publicUser(user);
  sessions.set(token, safeUser);
  return { ...safeUser, token };
}

function authToken(req) {
  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return req.query.token;
}

function requireAuth(req, res, next) {
  if (req.path.startsWith("/auth/") || req.originalUrl.startsWith("/api/auth/")) {
    return next();
  }

  const token = authToken(req);
  const user = token ? sessions.get(token) : null;
  if (!user) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }

  req.user = user;
  return next();
}

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

function registerCrudRoutes(name, config) {
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

app.use("/api", requireAuth);

Object.entries(resources).forEach(([name, config]) => registerCrudRoutes(name, config));

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
      sessions.delete(token);
    }
    return res.status(204).send();
  }),
);

app.get(
  "/api/overview",
  asyncRoute(async (req, res) => {
    const tables = [
      ["teachers", "teachers"],
      ["groups", "student_groups"],
      ["subjects", "subjects"],
      ["classrooms", "classrooms"],
      ["assignments", "teaching_assignments"],
      ["versions", "schedule_versions"],
    ];
    const entries = await Promise.all(
      tables.map(async ([key, table]) => {
        const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id = $1`, [
          req.user.user_id,
        ]);
        return [key, result.rows[0].count];
      }),
    );
    res.json(Object.fromEntries(entries));
  }),
);

app.get(
  "/api/catalog",
  asyncRoute(async (req, res) => {
    const userId = req.user.user_id;
    const [
      departments,
      semesters,
      teachers,
      groups,
      subjects,
      lessonTypes,
      buildings,
      classrooms,
      timeSlots,
      assignments,
      teacherUnavailability,
      groupUnavailability,
      classroomUnavailability,
      teacherPreferences,
    ] = await Promise.all([
      pool.query("SELECT * FROM departments WHERE user_id = $1 ORDER BY name", [userId]),
      pool.query("SELECT * FROM semesters WHERE user_id = $1 ORDER BY starts_on DESC", [userId]),
      pool.query("SELECT * FROM teachers WHERE user_id = $1 ORDER BY full_name", [userId]),
      pool.query("SELECT * FROM student_groups WHERE user_id = $1 ORDER BY name", [userId]),
      pool.query("SELECT * FROM subjects WHERE user_id = $1 ORDER BY name", [userId]),
      pool.query("SELECT * FROM lesson_types WHERE user_id = $1 ORDER BY name", [userId]),
      pool.query("SELECT * FROM buildings WHERE user_id = $1 ORDER BY name", [userId]),
      pool.query("SELECT * FROM classrooms WHERE user_id = $1 ORDER BY name", [userId]),
      pool.query("SELECT * FROM time_slots WHERE user_id = $1 ORDER BY day_of_week, pair_number", [userId]),
      pool.query(`
        SELECT ta.*, t.full_name AS teacher_name, s.name AS subject_name,
               g.name AS group_name, lt.name AS lesson_type_name
        FROM teaching_assignments ta
        JOIN teachers t ON t.teacher_id = ta.teacher_id
        JOIN subjects s ON s.subject_id = ta.subject_id
        JOIN student_groups g ON g.group_id = ta.group_id
        JOIN lesson_types lt ON lt.lesson_type_id = ta.lesson_type_id
        WHERE ta.user_id = $1
        ORDER BY g.name, s.name
      `, [userId]),
      pool.query(`
        SELECT tu.*, t.full_name AS teacher_name, ts.day_of_week, ts.pair_number
        FROM teacher_unavailability tu
        JOIN teachers t ON t.teacher_id = tu.teacher_id
        JOIN time_slots ts ON ts.time_slot_id = tu.time_slot_id
        WHERE tu.user_id = $1
        ORDER BY t.full_name, ts.day_of_week, ts.pair_number
      `, [userId]),
      pool.query(`
        SELECT gu.*, g.name AS group_name, ts.day_of_week, ts.pair_number
        FROM group_unavailability gu
        JOIN student_groups g ON g.group_id = gu.group_id
        JOIN time_slots ts ON ts.time_slot_id = gu.time_slot_id
        WHERE gu.user_id = $1
        ORDER BY g.name, ts.day_of_week, ts.pair_number
      `, [userId]),
      pool.query(`
        SELECT cu.*, c.name AS classroom_name, ts.day_of_week, ts.pair_number
        FROM classroom_unavailability cu
        JOIN classrooms c ON c.classroom_id = cu.classroom_id
        JOIN time_slots ts ON ts.time_slot_id = cu.time_slot_id
        WHERE cu.user_id = $1
        ORDER BY c.name, ts.day_of_week, ts.pair_number
      `, [userId]),
      pool.query(`
        SELECT tp.*, t.full_name AS teacher_name, ts.day_of_week, ts.pair_number
        FROM teacher_preferences tp
        JOIN teachers t ON t.teacher_id = tp.teacher_id
        JOIN time_slots ts ON ts.time_slot_id = tp.time_slot_id
        WHERE tp.user_id = $1
        ORDER BY t.full_name, ts.day_of_week, ts.pair_number
      `, [userId]),
    ]);

    res.json({
      departments: departments.rows,
      semesters: semesters.rows,
      teachers: teachers.rows,
      groups: groups.rows,
      subjects: subjects.rows,
      lessonTypes: lessonTypes.rows,
      buildings: buildings.rows,
      classrooms: classrooms.rows,
      timeSlots: timeSlots.rows,
      assignments: assignments.rows,
      teacherUnavailability: teacherUnavailability.rows,
      groupUnavailability: groupUnavailability.rows,
      classroomUnavailability: classroomUnavailability.rows,
      teacherPreferences: teacherPreferences.rows,
    });
  }),
);

async function getScheduleEntries(versionId, userId) {
  const result = await pool.query(
    `
      SELECT se.entry_id, se.version_id, se.assignment_id, se.time_slot_id, se.classroom_id,
             ts.day_of_week, ts.pair_number, ts.starts_at, ts.ends_at,
             t.teacher_id, t.full_name AS teacher_name,
             g.group_id, g.name AS group_name, g.students_count,
             s.name AS subject_name, lt.name AS lesson_type_name,
             c.name AS classroom_name, c.capacity,
             b.name AS building_name
      FROM schedule_entries se
      JOIN time_slots ts ON ts.time_slot_id = se.time_slot_id
      JOIN classrooms c ON c.classroom_id = se.classroom_id
      LEFT JOIN buildings b ON b.building_id = c.building_id
      JOIN teaching_assignments ta ON ta.assignment_id = se.assignment_id
      JOIN teachers t ON t.teacher_id = ta.teacher_id
      JOIN student_groups g ON g.group_id = ta.group_id
      JOIN subjects s ON s.subject_id = ta.subject_id
      JOIN lesson_types lt ON lt.lesson_type_id = ta.lesson_type_id
      WHERE se.version_id = $1 AND ta.user_id = $2
      ORDER BY ts.day_of_week, ts.pair_number, g.name
    `,
    [versionId, userId],
  );
  return result.rows;
}

function calculateMetrics(entries, preferences = []) {
  const conflicts = [];
  const used = {
    teachers: new Map(),
    groups: new Map(),
    classrooms: new Map(),
  };

  for (const entry of entries) {
    for (const [type, id] of [
      ["teachers", entry.teacher_id],
      ["groups", entry.group_id],
      ["classrooms", entry.classroom_id],
    ]) {
      const key = `${id}:${entry.time_slot_id}`;
      if (used[type].has(key)) {
        conflicts.push({
          type,
          time_slot_id: entry.time_slot_id,
          entries: [used[type].get(key), entry.entry_id],
        });
      }
      used[type].set(key, entry.entry_id);
    }

    if (entry.capacity < entry.students_count) {
      conflicts.push({
        type: "capacity",
        entry_id: entry.entry_id,
        message: "Вместимость аудитории меньше численности группы",
      });
    }
  }

  const gapsByResource = new Map();
  for (const entry of entries) {
    for (const prefix of ["teacher", "group"]) {
      const id = prefix === "teacher" ? entry.teacher_id : entry.group_id;
      const key = `${prefix}:${id}:${entry.day_of_week}`;
      if (!gapsByResource.has(key)) gapsByResource.set(key, []);
      gapsByResource.get(key).push(entry.pair_number);
    }
  }

  let gaps = 0;
  for (const pairNumbers of gapsByResource.values()) {
    const unique = [...new Set(pairNumbers)].sort((a, b) => a - b);
    for (let index = 1; index < unique.length; index += 1) {
      gaps += Math.max(0, unique[index] - unique[index - 1] - 1);
    }
  }

  const preferenceMap = new Map(
    preferences.map((item) => [`${item.teacher_id}:${item.time_slot_id}`, item]),
  );
  const preferenceScore = entries.reduce((score, entry) => {
    const preference = preferenceMap.get(`${entry.teacher_id}:${entry.time_slot_id}`);
    if (!preference) return score;
    return score + (preference.preference === "preferred" ? preference.weight : -preference.weight);
  }, 0);

  return {
    conflicts_count: conflicts.length,
    gaps_count: gaps,
    preference_score: preferenceScore,
    conflicts,
  };
}

app.get(
  "/api/schedule/versions",
  asyncRoute(async (req, res) => {
    const result = await pool.query(`
      SELECT sv.*, s.name AS semester_name
      FROM schedule_versions sv
      JOIN semesters s ON s.semester_id = sv.semester_id
      WHERE sv.user_id = $1
      ORDER BY sv.created_at DESC
    `, [req.user.user_id]);
    res.json(result.rows);
  }),
);

app.get(
  "/api/schedule/versions/:id",
  asyncRoute(async (req, res) => {
    const version = await pool.query("SELECT * FROM schedule_versions WHERE version_id = $1 AND user_id = $2", [
      req.params.id,
      req.user.user_id,
    ]);
    if (version.rowCount === 0) {
      return res.status(404).json({ error: "Версия расписания не найдена" });
    }
    const entries = await getScheduleEntries(req.params.id, req.user.user_id);
    return res.json({ version: version.rows[0], entries });
  }),
);

app.post(
  "/api/schedule/versions/:id/activate",
  asyncRoute(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const version = await client.query("SELECT * FROM schedule_versions WHERE version_id = $1 AND user_id = $2", [
        req.params.id,
        req.user.user_id,
      ]);
      if (version.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Версия расписания не найдена" });
      }
      await client.query("UPDATE schedule_versions SET status = 'archived' WHERE semester_id = $1 AND user_id = $2", [
        version.rows[0].semester_id,
        req.user.user_id,
      ]);
      const result = await client.query(
        "UPDATE schedule_versions SET status = 'active' WHERE version_id = $1 AND user_id = $2 RETURNING *",
        [req.params.id, req.user.user_id],
      );
      await client.query("COMMIT");
      await audit("activate", "schedule_versions", req.params.id);
      return res.json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  "/api/schedule/generate",
  asyncRoute(async (req, res) => {
    const client = await pool.connect();
    try {
      const semesterId = req.body.semester_id;
      if (!semesterId) {
        return res.status(400).json({ error: "Не выбран семестр" });
      }
      const userId = req.user.user_id;
      const semester = await pool.query("SELECT semester_id FROM semesters WHERE semester_id = $1 AND user_id = $2", [
        semesterId,
        userId,
      ]);
      if (semester.rowCount === 0) {
        return res.status(404).json({ error: "Семестр не найден" });
      }

      const [assignments, slots, classrooms, teacherBlocked, groupBlocked, classroomBlocked, preferences] =
        await Promise.all([
          pool.query("SELECT * FROM teaching_assignments WHERE semester_id = $1 AND user_id = $2 ORDER BY assignment_id", [
            semesterId,
            userId,
          ]),
          pool.query("SELECT * FROM time_slots WHERE user_id = $1 ORDER BY day_of_week, pair_number", [userId]),
          pool.query("SELECT * FROM classrooms WHERE user_id = $1 ORDER BY capacity DESC, classroom_id", [userId]),
          pool.query("SELECT teacher_id, time_slot_id FROM teacher_unavailability WHERE user_id = $1", [userId]),
          pool.query("SELECT group_id, time_slot_id FROM group_unavailability WHERE user_id = $1", [userId]),
          pool.query("SELECT classroom_id, time_slot_id FROM classroom_unavailability WHERE user_id = $1", [userId]),
          pool.query("SELECT * FROM teacher_preferences WHERE user_id = $1", [userId]),
        ]);

      if (assignments.rowCount === 0) {
        return res.status(400).json({ error: "Для выбранного семестра нет учебных поручений" });
      }
      if (slots.rowCount === 0 || classrooms.rowCount === 0) {
        return res.status(400).json({ error: "Нужны временные слоты и аудитории" });
      }

      const unavailable = {
        teacher: new Set(teacherBlocked.rows.map((item) => `${item.teacher_id}:${item.time_slot_id}`)),
        group: new Set(groupBlocked.rows.map((item) => `${item.group_id}:${item.time_slot_id}`)),
        classroom: new Set(
          classroomBlocked.rows.map((item) => `${item.classroom_id}:${item.time_slot_id}`),
        ),
      };
      const preferenceMap = new Map(
        preferences.rows.map((item) => [`${item.teacher_id}:${item.time_slot_id}`, item]),
      );
      const busy = {
        teacher: new Set(),
        group: new Set(),
        classroom: new Set(),
      };
      const generated = [];
      const skipped = [];

      for (const assignment of assignments.rows) {
        const lessonsCount = Math.max(1, Math.ceil(assignment.hours_per_week / 2));
        for (let lessonIndex = 0; lessonIndex < lessonsCount; lessonIndex += 1) {
          let best = null;

          for (const slot of slots.rows) {
            if (unavailable.teacher.has(`${assignment.teacher_id}:${slot.time_slot_id}`)) continue;
            if (unavailable.group.has(`${assignment.group_id}:${slot.time_slot_id}`)) continue;
            if (busy.teacher.has(`${assignment.teacher_id}:${slot.time_slot_id}`)) continue;
            if (busy.group.has(`${assignment.group_id}:${slot.time_slot_id}`)) continue;

            for (const classroom of classrooms.rows) {
              if (classroom.capacity < assignment.classroom_capacity_required) continue;
              if (unavailable.classroom.has(`${classroom.classroom_id}:${slot.time_slot_id}`)) continue;
              if (busy.classroom.has(`${classroom.classroom_id}:${slot.time_slot_id}`)) continue;

              const preference = preferenceMap.get(`${assignment.teacher_id}:${slot.time_slot_id}`);
              const score =
                (preference?.preference === "preferred" ? 8 : 0) -
                (preference?.preference === "undesired" ? 8 : 0) -
                slot.pair_number +
                (slot.day_of_week <= 5 ? 2 : -4);

              if (!best || score > best.score) {
                best = { slot, classroom, score };
              }
            }
          }

          if (!best) {
            skipped.push({
              assignment_id: assignment.assignment_id,
              reason: "Не найден допустимый слот и аудитория",
            });
            continue;
          }

          busy.teacher.add(`${assignment.teacher_id}:${best.slot.time_slot_id}`);
          busy.group.add(`${assignment.group_id}:${best.slot.time_slot_id}`);
          busy.classroom.add(`${best.classroom.classroom_id}:${best.slot.time_slot_id}`);
          generated.push({
            assignment_id: assignment.assignment_id,
            time_slot_id: best.slot.time_slot_id,
            classroom_id: best.classroom.classroom_id,
          });
        }
      }

      await client.query("BEGIN");
      const version = await client.query(
        "INSERT INTO schedule_versions (user_id, semester_id, name, status) VALUES ($1, $2, $3, 'draft') RETURNING *",
        [userId, semesterId, req.body.name || `Автогенерация ${new Date().toLocaleString("ru-RU")}`],
      );

      for (const entry of generated) {
        await client.query(
          "INSERT INTO schedule_entries (version_id, assignment_id, time_slot_id, classroom_id) VALUES ($1, $2, $3, $4)",
          [version.rows[0].version_id, entry.assignment_id, entry.time_slot_id, entry.classroom_id],
        );
      }

      await client.query("COMMIT");

      const entries = await getScheduleEntries(version.rows[0].version_id, userId);
      const metrics = calculateMetrics(entries, preferences.rows);
      const updated = await pool.query(
        `UPDATE schedule_versions
         SET conflicts_count = $1, gaps_count = $2, preference_score = $3
         WHERE version_id = $4
         RETURNING *`,
        [
          metrics.conflicts_count + skipped.length,
          metrics.gaps_count,
          metrics.preference_score,
          version.rows[0].version_id,
        ],
      );

      await audit("generate", "schedule_versions", version.rows[0].version_id, {
        generated: generated.length,
        skipped,
      });

      return res.status(201).json({
        version: updated.rows[0],
        entries,
        metrics: { ...metrics, conflicts_count: metrics.conflicts_count + skipped.length, skipped },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.put(
  "/api/schedule/entries/:id",
  asyncRoute(async (req, res) => {
    const { time_slot_id, classroom_id } = req.body;
    const result = await pool.query(
      `UPDATE schedule_entries
       SET time_slot_id = COALESCE($1, time_slot_id),
           classroom_id = COALESCE($2, classroom_id)
       WHERE entry_id = $3
         AND version_id IN (SELECT version_id FROM schedule_versions WHERE user_id = $4)
       RETURNING *`,
      [time_slot_id || null, classroom_id || null, req.params.id, req.user.user_id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Занятие не найдено" });
    }
    await audit("update", "schedule_entries", req.params.id, req.body);
    return res.json(result.rows[0]);
  }),
);

app.get(
  "/api/schedule/versions/:id/validate",
  asyncRoute(async (req, res) => {
    const entries = await getScheduleEntries(req.params.id, req.user.user_id);
    const preferences = await pool.query("SELECT * FROM teacher_preferences WHERE user_id = $1", [req.user.user_id]);
    const metrics = calculateMetrics(entries, preferences.rows);
    await pool.query(
      `UPDATE schedule_versions
       SET conflicts_count = $1, gaps_count = $2, preference_score = $3
       WHERE version_id = $4 AND user_id = $5`,
      [metrics.conflicts_count, metrics.gaps_count, metrics.preference_score, req.params.id, req.user.user_id],
    );
    res.json(metrics);
  }),
);

app.get(
  "/api/schedule/versions/:id/export.csv",
  asyncRoute(async (req, res) => {
    const entries = await getScheduleEntries(req.params.id, req.user.user_id);
    const header = [
      "День",
      "Пара",
      "Время",
      "Группа",
      "Дисциплина",
      "Тип",
      "Преподаватель",
      "Аудитория",
    ];
    const rows = entries.map((entry) => [
      dayNames[entry.day_of_week],
      entry.pair_number,
      `${entry.starts_at}-${entry.ends_at}`,
      entry.group_name,
      entry.subject_name,
      entry.lesson_type_name,
      entry.teacher_name,
      `${entry.building_name || ""} ${entry.classroom_name}`.trim(),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="schedule-${req.params.id}.csv"`);
    res.send(`\uFEFF${csv}`);
  }),
);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === "23503") {
    return res.status(409).json({
      error: "Запись используется в связанных данных и не может быть удалена",
      details: error.detail,
    });
  }
  if (error.code === "23505") {
    return res.status(409).json({
      error: "Такая запись уже существует",
      details: error.detail,
    });
  }
  if (error.code === "22P02") {
    return res.status(400).json({
      error: "Некорректный тип данных в одном из полей",
      details: error.message,
    });
  }
  res.status(500).json({
    error: "Ошибка сервера",
    details: error.message,
  });
});

ensureOwnershipSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend started on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database ownership schema", error);
    process.exit(1);
  });
