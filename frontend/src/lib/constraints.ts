import type { Catalog, ConstraintKey, RowData, TimeSlot } from "../types";

export type ConstraintMode = "unavailability" | "preference";

export type ConstraintViewConfig = {
  title: string;
  entityLabel: string;
  entityIdKey: string;
  entityNameKey: string;
  resource: string;
  recordIdKey: string;
  mode: ConstraintMode;
  entities: RowData[];
  records: RowData[];
};

export const preferenceOrder = ["", "preferred", "undesired"] as const;

export function constraintConfig(key: ConstraintKey, catalog: Catalog): ConstraintViewConfig {
  if (key === "groupUnavailability") {
    return {
      title: "Недоступность групп",
      entityLabel: "Группа",
      entityIdKey: "group_id",
      entityNameKey: "name",
      resource: "groupUnavailability",
      recordIdKey: "unavailable_id",
      mode: "unavailability",
      entities: catalog.groups,
      records: catalog.groupUnavailability,
    };
  }

  if (key === "classroomUnavailability") {
    return {
      title: "Недоступность аудиторий",
      entityLabel: "Аудитория",
      entityIdKey: "classroom_id",
      entityNameKey: "name",
      resource: "classroomUnavailability",
      recordIdKey: "unavailable_id",
      mode: "unavailability",
      entities: catalog.classrooms,
      records: catalog.classroomUnavailability,
    };
  }

  if (key === "teacherPreferences") {
    return {
      title: "Предпочтения преподавателей",
      entityLabel: "Преподаватель",
      entityIdKey: "teacher_id",
      entityNameKey: "full_name",
      resource: "teacherPreferences",
      recordIdKey: "preference_id",
      mode: "preference",
      entities: catalog.teachers,
      records: catalog.teacherPreferences,
    };
  }

  return {
    title: "Недоступность преподавателей",
    entityLabel: "Преподаватель",
    entityIdKey: "teacher_id",
    entityNameKey: "full_name",
    resource: "teacherUnavailability",
    recordIdKey: "unavailable_id",
    mode: "unavailability",
    entities: catalog.teachers,
    records: catalog.teacherUnavailability,
  };
}

export function groupSlotsByDay(slots: TimeSlot[]) {
  return slots.reduce<Record<number, TimeSlot[]>>((groups, slot) => {
    groups[slot.day_of_week] = [...(groups[slot.day_of_week] ?? []), slot].sort((left, right) => left.pair_number - right.pair_number);
    return groups;
  }, {});
}

export function uniquePairNumbers(slots: TimeSlot[]) {
  return [...new Set(slots.map((slot) => slot.pair_number))].sort((left, right) => left - right);
}

export function mapRecordsBySlot(records: RowData[], entityIdKey: string, selectedEntityId: string) {
  return new Map(
    records
      .filter((record) => String(record[entityIdKey]) === selectedEntityId)
      .map((record) => [String(record.time_slot_id), record]),
  );
}

export function slotState(mode: ConstraintMode, record?: RowData) {
  if (!record) return { className: "slot-state", label: "" };
  if (mode === "unavailability") return { className: "slot-state blocked", label: "Н" };
  if (record.preference === "preferred") return { className: "slot-state preferred", label: "+" };
  return { className: "slot-state undesired", label: "-" };
}
