import { dayNames } from "../constants";
import type { Catalog, DictionaryConfig, FieldConfig, RowData, RowValue, TimeSlot, TimeSlotTemplate } from "../types";

export function buildDictionaryConfigs(catalog: Catalog): DictionaryConfig[] {
  const departmentField = selectField("department_id", "Кафедра", catalog.departments, "department_id", "name", false);
  const buildingField = selectField("building_id", "Корпус", catalog.buildings, "building_id", "name", false);

  return [
    {
      key: "departments",
      title: "Кафедры",
      resource: "departments",
      idKey: "department_id",
      rows: catalog.departments,
      fields: [field("name", "Название")],
    },
    {
      key: "semesters",
      title: "Семестры",
      resource: "semesters",
      idKey: "semester_id",
      rows: catalog.semesters,
      fields: [
        field("name", "Название"),
        field("starts_on", "Дата начала", "date"),
        field("ends_on", "Дата окончания", "date"),
        field("is_active", "Активный", "checkbox", false, false),
      ],
    },
    {
      key: "teachers",
      title: "Преподаватели",
      resource: "teachers",
      idKey: "teacher_id",
      rows: catalog.teachers,
      fields: [
        field("full_name", "ФИО"),
        field("position", "Должность", "text", "", false),
        field("max_hours_per_week", "Макс. часов", "number", 18),
        departmentField,
        field("notes", "Примечание", "text", "", false),
      ],
    },
    {
      key: "groups",
      title: "Учебные группы",
      resource: "groups",
      idKey: "group_id",
      rows: catalog.groups,
      fields: [
        field("name", "Название"),
        field("course", "Курс", "number", 1),
        field("students_count", "Студентов", "number", 25),
        departmentField,
      ],
    },
    {
      key: "subjects",
      title: "Дисциплины",
      resource: "subjects",
      idKey: "subject_id",
      rows: catalog.subjects,
      fields: [field("name", "Название"), field("total_hours", "Часы", "number", 72), departmentField],
    },
    {
      key: "lessonTypes",
      title: "Типы занятий",
      resource: "lessonTypes",
      idKey: "lesson_type_id",
      rows: catalog.lessonTypes,
      fields: [field("name", "Название")],
    },
    {
      key: "buildings",
      title: "Корпуса",
      resource: "buildings",
      idKey: "building_id",
      rows: catalog.buildings,
      fields: [field("name", "Название"), field("address", "Адрес", "text", "", false)],
    },
    {
      key: "classrooms",
      title: "Аудитории",
      resource: "classrooms",
      idKey: "classroom_id",
      rows: catalog.classrooms,
      fields: [
        buildingField,
        field("name", "Номер"),
        field("capacity", "Вместимость", "number", 30),
        field("equipment", "Оборудование", "text", "", false),
      ],
    },
    {
      key: "timeSlots",
      title: "Временные слоты",
      resource: "timeSlotTemplates",
      idKey: "pair_number",
      rows: timeSlotTemplateRows(catalog.timeSlots),
      fields: [
        field("pair_number", "№", "number", 1),
        field("starts_at", "Начало", "time", "08:30"),
        field("ends_at", "Окончание", "time", "10:00"),
      ],
    },
    {
      key: "assignments",
      title: "Учебные поручения",
      resource: "assignments",
      idKey: "assignment_id",
      rows: catalog.assignments,
      fields: assignmentFields(catalog),
    },
  ];
}

export function buildConstraintConfigs(catalog: Catalog): DictionaryConfig[] {
  const slotField = selectField("time_slot_id", "Временной слот", slotOptions(catalog.timeSlots), "time_slot_id", "label");
  const teacherField = selectField("teacher_id", "Преподаватель", catalog.teachers, "teacher_id", "full_name");
  const groupField = selectField("group_id", "Группа", catalog.groups, "group_id", "name");
  const classroomField = selectField("classroom_id", "Аудитория", catalog.classrooms, "classroom_id", "name");
  const reasonField = field("reason", "Причина", "text", "", false);
  const preferenceField = selectField(
    "preference",
    "Тип",
    [
      { value: "preferred", label: "Предпочтительно" },
      { value: "undesired", label: "Нежелательно" },
    ],
    "value",
    "label",
  );

  return [
    {
      key: "teacherUnavailability",
      title: "Недоступность преподавателей",
      resource: "teacherUnavailability",
      idKey: "unavailable_id",
      rows: catalog.teacherUnavailability,
      fields: [teacherField, slotField, reasonField],
    },
    {
      key: "groupUnavailability",
      title: "Недоступность групп",
      resource: "groupUnavailability",
      idKey: "unavailable_id",
      rows: catalog.groupUnavailability,
      fields: [groupField, slotField, reasonField],
    },
    {
      key: "classroomUnavailability",
      title: "Недоступность аудиторий",
      resource: "classroomUnavailability",
      idKey: "unavailable_id",
      rows: catalog.classroomUnavailability,
      fields: [classroomField, slotField, reasonField],
    },
    {
      key: "teacherPreferences",
      title: "Предпочтения преподавателей",
      resource: "teacherPreferences",
      idKey: "preference_id",
      rows: catalog.teacherPreferences,
      fields: [teacherField, slotField, preferenceField, field("weight", "Вес", "number", 1)],
    },
  ];
}

export function field(
  name: string,
  label: string,
  type: FieldConfig["type"] = "text",
  defaultValue: RowValue = "",
  required = true,
): FieldConfig {
  return { name, label, type, defaultValue, required };
}

export function selectField<T extends object>(
  name: string,
  label: string,
  options: T[],
  valueKey: keyof T,
  labelKey: keyof T,
  required = true,
): FieldConfig {
  return {
    name,
    label,
    type: "select",
    options: options as Record<string, unknown>[],
    valueKey: String(valueKey),
    labelKey: String(labelKey),
    defaultValue: String(options[0]?.[valueKey] ?? ""),
    required,
  };
}

export function multiSelectField<T extends object>(
  name: string,
  label: string,
  options: T[],
  valueKey: keyof T,
  labelKey: keyof T,
  required = true,
): FieldConfig {
  return {
    name,
    label,
    type: "multiselect",
    options: options as Record<string, unknown>[],
    valueKey: String(valueKey),
    labelKey: String(labelKey),
    defaultValue: options[0] ? [String(options[0][valueKey])] : [],
    required,
  };
}

export function assignmentFields(catalog: Catalog): FieldConfig[] {
  return [
    selectField("semester_id", "Семестр", catalog.semesters, "semester_id", "name"),
    selectField("teacher_id", "Преподаватель", catalog.teachers, "teacher_id", "full_name"),
    selectField("subject_id", "Дисциплина", catalog.subjects, "subject_id", "name"),
    multiSelectField("group_ids", "\u0413\u0440\u0443\u043f\u043f\u044b", catalog.groups, "group_id", "name"),
    selectField("lesson_type_id", "Тип занятия", catalog.lessonTypes, "lesson_type_id", "name"),
    field("hours_per_week", "Часов в неделю", "number", 2),
    field("classroom_capacity_required", "Мин. вместимость", "number", 20),
  ];
}

export function emptyBody(fields: FieldConfig[]) {
  return Object.fromEntries(fields.map((item) => [item.name, item.defaultValue ?? (item.type === "checkbox" ? false : "")])) as RowData;
}

export function createDraft(config: DictionaryConfig) {
  const draft = emptyBody(config.fields);
  if (config.key === "timeSlots") {
    const lastNumber = config.rows.reduce((max, row) => Math.max(max, Number(row.pair_number) || 0), 0);
    draft.pair_number = lastNumber + 1;
  }
  return draft;
}

export function fieldsToBody(row: RowData, fields: FieldConfig[]) {
  return Object.fromEntries(fields.map((item) => [item.name, normalizeDraftValue(row[item.name], item)])) as RowData;
}

export function rowTitle(row: RowData, fields: FieldConfig[]) {
  const preferred = fields.find((item) => ["name", "full_name", "subject_id", "group_id", "group_ids"].includes(item.name)) ?? fields[0];
  return formatValue(row[preferred.name], preferred);
}

export function rowSubtitle(row: RowData, fields: FieldConfig[]) {
  const titleField = fields.find((item) => ["name", "full_name", "subject_id", "group_id", "group_ids"].includes(item.name)) ?? fields[0];
  return fields
    .filter((item) => item.name !== "name" && item.name !== "full_name" && item.name !== titleField.name)
    .slice(0, 3)
    .map((item) => formatValue(row[item.name], item))
    .filter((value) => value !== "-")
    .join(" · ");
}

export function normalizeDraftValue(value: RowValue, item: FieldConfig): RowValue {
  if (value === null || value === undefined) return item.type === "checkbox" ? false : "";
  if (item.type === "date") return String(value).slice(0, 10);
  if (item.type === "time") return String(value).slice(0, 5);
  return value;
}

export function normalizeInputValue(value: RowValue, type?: FieldConfig["type"]) {
  if (value === null || value === undefined) return "";
  if (type === "date") return String(value).slice(0, 10);
  if (type === "time") return String(value).slice(0, 5);
  return String(value);
}

export function formatValue(value: RowValue, item: FieldConfig) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "-";
  if (item.type === "multiselect") {
    const selectedValues = Array.isArray(value) ? value : String(value).split(",").filter(Boolean);
    const labels = selectedValues.map((selectedValue) => {
      const option = item.options?.find((entry) => String(entry[item.valueKey ?? "value"]) === String(selectedValue));
      return option ? String(option[item.labelKey ?? "label"]) : String(selectedValue);
    });
    return labels.join(", ");
  }
  if (item.type === "select") {
    const option = item.options?.find((entry) => String(entry[item.valueKey ?? "value"]) === String(value));
    if (option) return String(option[item.labelKey ?? "label"]);
  }
  if (item.type === "checkbox") return value ? "\u0414\u0430" : "\u041d\u0435\u0442";
  if (item.type === "date") return String(value).slice(0, 10);
  if (item.type === "time") return String(value).slice(0, 5);
  return String(value);
}

export function timeSlotTemplateRows(slots: TimeSlot[]): TimeSlotTemplate[] {
  const rows = new Map<number, TimeSlotTemplate>();
  slots.forEach((slot) => {
    if (!rows.has(slot.pair_number)) {
      rows.set(slot.pair_number, {
        pair_number: slot.pair_number,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
      });
    }
  });
  return Array.from(rows.values()).sort((left, right) => left.pair_number - right.pair_number);
}

export function slotOptions(slots: TimeSlot[]) {
  return slots.map((slot) => ({
    ...slot,
    label: `${dayNames[slot.day_of_week]} ${slot.pair_number} пара, ${trimTime(slot.starts_at)}-${trimTime(slot.ends_at)}`,
  }));
}

export function trimTime(value: string) {
  return value?.slice(0, 5);
}
