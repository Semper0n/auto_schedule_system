import { slotOptions } from "../../lib/dictionary";
import type { Catalog, Id, ScheduleEntry } from "../../types";
import { useState } from "react";

type InlineScheduleEditorProps = {
  catalog: Catalog;
  className?: string;
  disabled: boolean;
  entry: ScheduleEntry;
  onUpdate: (entryId: number, data: Record<string, Id>) => void;
};

export function InlineScheduleEditor({
  catalog,
  className = "",
  disabled,
  entry,
  onUpdate,
}: InlineScheduleEditorProps) {
  const [timeSlotId, setTimeSlotId] = useState(entry.time_slot_id);
  const [classroomId, setClassroomId] = useState(entry.classroom_id);

  return (
    <div className={`inline-editor ${className}`.trim()}>
      <select value={timeSlotId} onChange={(event) => setTimeSlotId(Number(event.target.value))}>
        {slotOptions(catalog.timeSlots).map((slot) => (
          <option key={slot.time_slot_id} value={slot.time_slot_id}>
            {slot.label}
          </option>
        ))}
      </select>
      <select value={classroomId} onChange={(event) => setClassroomId(Number(event.target.value))}>
        {catalog.classrooms.map((classroom) => (
          <option key={classroom.classroom_id} value={classroom.classroom_id}>
            {classroom.name}
          </option>
        ))}
      </select>
      <button
        disabled={disabled}
        onClick={() => onUpdate(entry.entry_id, { time_slot_id: timeSlotId, classroom_id: classroomId })}
        type="button"
      >
        OK
      </button>
    </div>
  );
}
