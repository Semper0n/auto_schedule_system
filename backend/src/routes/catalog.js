const { pool } = require("../db");
const { asyncRoute } = require("../utils/asyncRoute");

function registerCatalogRoutes(app) {
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
}

module.exports = { registerCatalogRoutes };
