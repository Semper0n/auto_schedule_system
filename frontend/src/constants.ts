import type { Catalog, ConstraintKey, DictionaryKey } from "./types";

export const API_URL = "http://localhost:3000/api";

export const emptyCatalog: Catalog = {
  departments: [],
  semesters: [],
  teachers: [],
  groups: [],
  subjects: [],
  lessonTypes: [],
  buildings: [],
  classrooms: [],
  timeSlots: [],
  assignments: [],
  teacherUnavailability: [],
  groupUnavailability: [],
  classroomUnavailability: [],
  teacherPreferences: [],
};

export const dayNames: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

export const sections = [
  { id: "dashboard", label: "Обзор" },
  { id: "data", label: "Данные" },
  { id: "constraints", label: "Ограничения" },
  { id: "schedule", label: "Расписание" },
] as const;

export const dictionaryMenu: Array<{ key: DictionaryKey; label: string }> = [
  { key: "departments", label: "Кафедры" },
  { key: "semesters", label: "Семестры" },
  { key: "teachers", label: "Преподаватели" },
  { key: "groups", label: "Учебные группы" },
  { key: "subjects", label: "Дисциплины" },
  { key: "lessonTypes", label: "Типы занятий" },
  { key: "buildings", label: "Корпуса" },
  { key: "classrooms", label: "Аудитории" },
  { key: "timeSlots", label: "Временные слоты" },
  { key: "assignments", label: "Учебные поручения" },
];

export const constraintMenu: Array<{ key: ConstraintKey; label: string }> = [
  { key: "teacherUnavailability", label: "Недоступность преподавателей" },
  { key: "teacherPreferences", label: "Предпочтения преподавателей" },
  { key: "classroomUnavailability", label: "Недоступность аудиторий" },
  { key: "groupUnavailability", label: "Недоступность групп" },
];
