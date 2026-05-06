export type Id = number | string | boolean;
export type RowValue = Id | Id[] | null;
export type RowData = Record<string, RowValue>;

export type AuthUser = {
  user_id: number;
  username: string;
  role: string;
  token: string;
};

export type Catalog = {
  departments: Department[];
  semesters: Semester[];
  teachers: Teacher[];
  groups: StudentGroup[];
  subjects: Subject[];
  lessonTypes: LessonType[];
  buildings: Building[];
  classrooms: Classroom[];
  timeSlots: TimeSlot[];
  assignments: Assignment[];
  teacherUnavailability: TeacherUnavailability[];
  groupUnavailability: GroupUnavailability[];
  classroomUnavailability: ClassroomUnavailability[];
  teacherPreferences: TeacherPreference[];
};

export type Department = RowData & { department_id: number; name: string };
export type Semester = RowData & { semester_id: number; name: string; starts_on: string; ends_on: string; is_active: boolean };
export type Teacher = RowData & {
  teacher_id: number;
  department_id: number | null;
  full_name: string;
  position: string | null;
  max_hours_per_week: number;
  notes: string | null;
};
export type StudentGroup = RowData & {
  group_id: number;
  department_id: number | null;
  name: string;
  course: number;
  students_count: number;
};
export type Subject = RowData & { subject_id: number; department_id: number | null; name: string; total_hours: number };
export type LessonType = RowData & { lesson_type_id: number; name: string };
export type Building = RowData & { building_id: number; name: string; address: string | null };
export type Classroom = RowData & {
  classroom_id: number;
  building_id: number | null;
  name: string;
  capacity: number;
  equipment: string | null;
};
export type TimeSlot = RowData & {
  time_slot_id: number;
  day_of_week: number;
  pair_number: number;
  starts_at: string;
  ends_at: string;
};
export type TimeSlotTemplate = RowData & {
  pair_number: number;
  starts_at: string;
  ends_at: string;
};
export type Assignment = RowData & {
  assignment_id: number;
  semester_id: number;
  teacher_id: number;
  subject_id: number;
  group_id: number;
  group_ids: number[];
  lesson_type_id: number;
  hours_per_week: number;
  classroom_capacity_required: number;
  teacher_name: string;
  subject_name: string;
  group_name: string;
  lesson_type_name: string;
};
export type TeacherUnavailability = RowData & {
  unavailable_id: number;
  teacher_id: number;
  time_slot_id: number;
  reason: string | null;
  teacher_name: string;
  day_of_week: number;
  pair_number: number;
};
export type GroupUnavailability = RowData & {
  unavailable_id: number;
  group_id: number;
  time_slot_id: number;
  reason: string | null;
  group_name: string;
  day_of_week: number;
  pair_number: number;
};
export type ClassroomUnavailability = RowData & {
  unavailable_id: number;
  classroom_id: number;
  time_slot_id: number;
  reason: string | null;
  classroom_name: string;
  day_of_week: number;
  pair_number: number;
};
export type TeacherPreference = RowData & {
  preference_id: number;
  teacher_id: number;
  time_slot_id: number;
  preference: string;
  weight: number;
  teacher_name: string;
  day_of_week: number;
  pair_number: number;
};
export type Version = {
  version_id: number;
  semester_id: number;
  semester_name: string;
  name: string;
  status: string;
  conflicts_count: number;
  gaps_count: number;
  preference_score: number;
  created_at: string;
};
export type ScheduleEntry = {
  entry_id: number;
  time_slot_id: number;
  classroom_id: number;
  day_of_week: number;
  pair_number: number;
  starts_at: string;
  ends_at: string;
  teacher_name: string;
  group_ids: number[];
  group_name: string;
  subject_name: string;
  lesson_type_name: string;
  classroom_name: string;
  building_name: string | null;
};

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "multiselect" | "checkbox";
  defaultValue?: RowValue;
  options?: Record<string, unknown>[];
  valueKey?: string;
  labelKey?: string;
  required?: boolean;
  readOnly?: boolean;
};

export type Section = (typeof import("./constants").sections)[number]["id"];
export type DictionaryKey =
  | "departments"
  | "semesters"
  | "teachers"
  | "groups"
  | "subjects"
  | "lessonTypes"
  | "buildings"
  | "classrooms"
  | "timeSlots"
  | "assignments";
export type ConstraintKey =
  | "teacherUnavailability"
  | "teacherPreferences"
  | "classroomUnavailability"
  | "groupUnavailability";

export type DictionaryConfig = {
  key: DictionaryKey | ConstraintKey;
  title: string;
  resource: string;
  idKey: string;
  rows: RowData[];
  fields: FieldConfig[];
};
