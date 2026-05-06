import { useEffect, useMemo, useState } from "react";
import { dayNames } from "../constants";
import { trimTime } from "../lib/dictionary";
import type { Catalog, ConstraintKey, RowData, TimeSlot } from "../types";

type ConstraintHandlers = {
  onCreate: (resource: string, body: RowData) => void;
  onUpdate: (resource: string, id: number, body: RowData) => void;
  onDelete: (resource: string, ids: number[]) => void;
};

type ConstraintsSectionProps = ConstraintHandlers & {
  activeConstraint: ConstraintKey;
  catalog: Catalog;
  disabled: boolean;
};

type ConstraintMode = "unavailability" | "preference";

type ConstraintViewConfig = {
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

const preferenceOrder = ["", "preferred", "undesired"] as const;

export function ConstraintsSection({
  activeConstraint,
  catalog,
  disabled,
  onCreate,
  onUpdate,
  onDelete,
}: ConstraintsSectionProps) {
  const config = constraintConfig(activeConstraint, catalog);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  useEffect(() => {
    setSelectedEntityId((current) => (
      config.entities.some((entity) => String(entity[config.entityIdKey]) === current)
        ? current
        : String(config.entities[0]?.[config.entityIdKey] ?? "")
    ));
  }, [activeConstraint, config.entityIdKey, config.entities]);

  const selectedEntity = config.entities.find((entity) => String(entity[config.entityIdKey]) === selectedEntityId);
  const slotsByDay = useMemo(() => groupSlotsByDay(catalog.timeSlots), [catalog.timeSlots]);
  const pairNumbers = useMemo(() => uniquePairNumbers(catalog.timeSlots), [catalog.timeSlots]);
  const dayNumbers = useMemo(() => Object.keys(slotsByDay).map(Number).sort((left, right) => left - right), [slotsByDay]);
  const recordsBySlot = useMemo(
    () => mapRecordsBySlot(config.records, config.entityIdKey, selectedEntityId),
    [config.records, config.entityIdKey, selectedEntityId],
  );

  function toggleSlot(slot: TimeSlot) {
    if (!selectedEntity || disabled) return;

    const current = recordsBySlot.get(String(slot.time_slot_id));
    if (config.mode === "unavailability") {
      if (current) {
        onDelete(config.resource, [Number(current[config.recordIdKey])]);
        return;
      }
      onCreate(config.resource, {
        [config.entityIdKey]: Number(selectedEntityId),
        time_slot_id: slot.time_slot_id,
        reason: "",
      });
      return;
    }

    const currentPreference = String(current?.preference ?? "");
    const nextPreference = preferenceOrder[(preferenceOrder.indexOf(currentPreference as typeof preferenceOrder[number]) + 1) % preferenceOrder.length];

    if (!current && nextPreference) {
      onCreate(config.resource, {
        [config.entityIdKey]: Number(selectedEntityId),
        time_slot_id: slot.time_slot_id,
        preference: nextPreference,
        weight: 1,
      });
      return;
    }

    if (current && nextPreference) {
      onUpdate(config.resource, Number(current[config.recordIdKey]), {
        [config.entityIdKey]: Number(selectedEntityId),
        time_slot_id: slot.time_slot_id,
        preference: nextPreference,
        weight: Number(current.weight) || 1,
      });
      return;
    }

    if (current) {
      onDelete(config.resource, [Number(current[config.recordIdKey])]);
    }
  }

  return (
    <div className="constraint-grid-view">
      <section className="toolbar constraint-toolbar">
        <div>
          <p className="eyebrow">Ограничения</p>
          <h2>{config.title}</h2>
        </div>
        <label>
          <span>{config.entityLabel}</span>
          <select
            disabled={disabled || config.entities.length === 0}
            onChange={(event) => setSelectedEntityId(event.target.value)}
            value={selectedEntityId}
          >
            {config.entities.map((entity) => (
              <option key={String(entity[config.entityIdKey])} value={String(entity[config.entityIdKey])}>
                {String(entity[config.entityNameKey] ?? entity[config.entityIdKey])}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="constraint-table-wrap">
        <table className="constraint-slot-table">
          <thead>
            <tr>
              <th>Слот</th>
              {dayNumbers.map((day) => (
                <th key={day}>{dayNames[day]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pairNumbers.map((pairNumber) => {
              const sampleSlot = catalog.timeSlots.find((item) => item.pair_number === pairNumber);
              return (
              <tr key={pairNumber}>
                <th>
                  <strong>{pairNumber}</strong>
                  {sampleSlot && <span>{trimTime(sampleSlot.starts_at)}-{trimTime(sampleSlot.ends_at)}</span>}
                </th>
                {dayNumbers.map((day) => {
                  const slot = slotsByDay[day]?.find((item) => item.pair_number === pairNumber);
                  const record = slot ? recordsBySlot.get(String(slot.time_slot_id)) : undefined;
                  const state = slotState(config.mode, record);
                  return (
                    <td key={day}>
                      {slot && (
                        <button
                          className={state.className}
                          disabled={disabled || !selectedEntity}
                          onClick={() => toggleSlot(slot)}
                          type="button"
                        >
                          {state.label}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function constraintConfig(key: ConstraintKey, catalog: Catalog): ConstraintViewConfig {
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

function groupSlotsByDay(slots: TimeSlot[]) {
  return slots.reduce<Record<number, TimeSlot[]>>((groups, slot) => {
    groups[slot.day_of_week] = [...(groups[slot.day_of_week] ?? []), slot].sort((left, right) => left.pair_number - right.pair_number);
    return groups;
  }, {});
}

function uniquePairNumbers(slots: TimeSlot[]) {
  return [...new Set(slots.map((slot) => slot.pair_number))].sort((left, right) => left - right);
}

function mapRecordsBySlot(records: RowData[], entityIdKey: string, selectedEntityId: string) {
  return new Map(
    records
      .filter((record) => String(record[entityIdKey]) === selectedEntityId)
      .map((record) => [String(record.time_slot_id), record]),
  );
}

function slotState(mode: ConstraintMode, record?: RowData) {
  if (!record) return { className: "slot-state", label: "" };
  if (mode === "unavailability") return { className: "slot-state blocked", label: "Н" };
  if (record.preference === "preferred") return { className: "slot-state preferred", label: "+" };
  return { className: "slot-state undesired", label: "-" };
}
