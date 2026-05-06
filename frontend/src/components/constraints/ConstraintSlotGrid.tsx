import { dayNames } from "../../constants";
import { groupSlotsByDay, mapRecordsBySlot, slotState, uniquePairNumbers } from "../../lib/constraints";
import { trimTime } from "../../lib/dictionary";
import type { ConstraintViewConfig } from "../../lib/constraints";
import type { RowData, TimeSlot } from "../../types";
import { useMemo } from "react";

type ConstraintSlotGridProps = {
  config: ConstraintViewConfig;
  disabled: boolean;
  selectedEntity?: RowData;
  selectedEntityId: string;
  slots: TimeSlot[];
  onToggleSlot: (slot: TimeSlot, current?: RowData) => void;
};

export function ConstraintSlotGrid({
  config,
  disabled,
  selectedEntity,
  selectedEntityId,
  slots,
  onToggleSlot,
}: ConstraintSlotGridProps) {
  const slotsByDay = useMemo(() => groupSlotsByDay(slots), [slots]);
  const pairNumbers = useMemo(() => uniquePairNumbers(slots), [slots]);
  const dayNumbers = useMemo(() => Object.keys(slotsByDay).map(Number).sort((left, right) => left - right), [slotsByDay]);
  const recordsBySlot = useMemo(
    () => mapRecordsBySlot(config.records, config.entityIdKey, selectedEntityId),
    [config.records, config.entityIdKey, selectedEntityId],
  );

  return (
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
            const sampleSlot = slots.find((item) => item.pair_number === pairNumber);
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
                          onClick={() => onToggleSlot(slot, record)}
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
  );
}
