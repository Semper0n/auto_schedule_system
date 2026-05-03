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

module.exports = { resources };
