import { useEffect, useState } from "react";
import { ConstraintSlotGrid } from "../components/constraints/ConstraintSlotGrid";
import { constraintConfig, preferenceOrder } from "../lib/constraints";
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

export function ConstraintsSection({
  activeConstraint,
  catalog,
  disabled,
  onCreate,
  onUpdate,
  onDelete,
}: ConstraintsSectionProps) {
  const config = constraintConfig(activeConstraint, catalog);
  const [selectedEntityId, setSelectedEntityId] = useState("");

  useEffect(() => {
    setSelectedEntityId((current) => (
      config.entities.some((entity) => String(entity[config.entityIdKey]) === current)
        ? current
        : String(config.entities[0]?.[config.entityIdKey] ?? "")
    ));
  }, [activeConstraint, config.entityIdKey, config.entities]);

  const selectedEntity = config.entities.find((entity) => String(entity[config.entityIdKey]) === selectedEntityId);

  function toggleSlot(slot: TimeSlot, current?: RowData) {
    if (!selectedEntity || disabled) return;

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

      <ConstraintSlotGrid
        config={config}
        disabled={disabled}
        onToggleSlot={toggleSlot}
        selectedEntity={selectedEntity}
        selectedEntityId={selectedEntityId}
        slots={catalog.timeSlots}
      />
    </div>
  );
}
