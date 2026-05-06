const { dayNames } = require("../config/constants");
const { pool } = require("../db");
const { audit } = require("../services/audit");
const { calculateMetrics, getScheduleEntries } = require("../services/schedule");
const { asyncRoute } = require("../utils/asyncRoute");

function registerScheduleRoutes(app) {
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

  app.put(
    "/api/schedule/versions/:id",
    asyncRoute(async (req, res) => {
      const name = String(req.body.name ?? "").trim();
      if (!name) {
        return res.status(400).json({ error: "Название версии не может быть пустым" });
      }
      const result = await pool.query(
        "UPDATE schedule_versions SET name = $1 WHERE version_id = $2 AND user_id = $3 RETURNING *",
        [name, req.params.id, req.user.user_id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Версия расписания не найдена" });
      }
      await audit("update", "schedule_versions", req.params.id, { name });
      return res.json(result.rows[0]);
    }),
  );

  app.delete(
    "/api/schedule/versions/:id",
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        "DELETE FROM schedule_versions WHERE version_id = $1 AND user_id = $2 RETURNING *",
        [req.params.id, req.user.user_id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Версия расписания не найдена" });
      }
      await audit("delete", "schedule_versions", req.params.id, result.rows[0]);
      return res.status(204).send();
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
            pool.query(`
              SELECT ta.*,
                     COALESCE(array_agg(g.group_id ORDER BY g.name) FILTER (WHERE g.group_id IS NOT NULL), ARRAY[ta.group_id]) AS group_ids,
                     COALESCE(SUM(g.students_count), fallback_group.students_count, 0)::int AS students_count
              FROM teaching_assignments ta
              LEFT JOIN teaching_assignment_groups tag ON tag.assignment_id = ta.assignment_id
              LEFT JOIN student_groups g ON g.group_id = tag.group_id
              LEFT JOIN student_groups fallback_group ON fallback_group.group_id = ta.group_id
              WHERE ta.semester_id = $1 AND ta.user_id = $2
              GROUP BY ta.assignment_id, fallback_group.students_count
              ORDER BY ta.assignment_id
            `, [
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
          const groupIds = assignment.group_ids?.length ? assignment.group_ids : [assignment.group_id];
          const lessonsCount = Math.max(1, Math.ceil(assignment.hours_per_week / 2));
          for (let lessonIndex = 0; lessonIndex < lessonsCount; lessonIndex += 1) {
            let best = null;

            for (const slot of slots.rows) {
              if (unavailable.teacher.has(`${assignment.teacher_id}:${slot.time_slot_id}`)) continue;
              if (groupIds.some((groupId) => unavailable.group.has(`${groupId}:${slot.time_slot_id}`))) continue;
              if (busy.teacher.has(`${assignment.teacher_id}:${slot.time_slot_id}`)) continue;
              if (groupIds.some((groupId) => busy.group.has(`${groupId}:${slot.time_slot_id}`))) continue;

              for (const classroom of classrooms.rows) {
                if (classroom.capacity < Math.max(assignment.classroom_capacity_required, assignment.students_count)) continue;
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
            for (const groupId of groupIds) {
              busy.group.add(`${groupId}:${best.slot.time_slot_id}`);
            }
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
}

module.exports = { registerScheduleRoutes };
