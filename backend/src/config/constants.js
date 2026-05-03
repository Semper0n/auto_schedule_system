const dayNames = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
};

const weekDays = [1, 2, 3, 4, 5, 6];

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

module.exports = { dayNames, weekDays, ownedTables };
