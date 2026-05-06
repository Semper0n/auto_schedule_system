import { dayNames } from "../../constants";
import { trimTime } from "../../lib/dictionary";
import type { Catalog, Id, ScheduleEntry } from "../../types";
import { InlineScheduleEditor } from "./InlineScheduleEditor";

type GroupScheduleGridProps = {
  catalog: Catalog;
  disabled: boolean;
  entries: ScheduleEntry[];
  groupName: string;
  onUpdateEntry: (entryId: number, data: Record<string, Id>) => void;
};

export function GroupScheduleGrid({
  catalog,
  disabled,
  entries,
  groupName,
  onUpdateEntry,
}: GroupScheduleGridProps) {
  const pairNumbers = [...new Set(catalog.timeSlots.map((slot) => slot.pair_number))].sort((left, right) => left - right);
  const dayNumbers = [...new Set(catalog.timeSlots.map((slot) => slot.day_of_week))].sort((left, right) => left - right);

  return (
    <section className="group-schedule-wrap">
      <table className="group-schedule-table">
        <thead>
          <tr>
            <th>{groupName || "\u0413\u0440\u0443\u043f\u043f\u0430"}</th>
            {dayNumbers.map((day) => (
              <th key={day}>{dayNames[day]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pairNumbers.map((pairNumber) => {
            const sampleSlot = catalog.timeSlots.find((slot) => slot.pair_number === pairNumber);
            return (
              <tr key={pairNumber}>
                <th>
                  <strong>{pairNumber}</strong>
                  {sampleSlot && <span>{trimTime(sampleSlot.starts_at)}-{trimTime(sampleSlot.ends_at)}</span>}
                </th>
                {dayNumbers.map((day) => {
                  const dayEntries = entries.filter((entry) => entry.day_of_week === day && entry.pair_number === pairNumber);
                  return (
                    <td key={day}>
                      {dayEntries.map((entry) => (
                        <article className="group-schedule-card" key={entry.entry_id}>
                          <div className="group-schedule-card-body">
                            <strong>{entry.subject_name}</strong>
                            <span>{entry.lesson_type_name}</span>
                            <span>{entry.teacher_name}</span>
                            <span>{entry.classroom_name} ({entry.building_name})</span>
                          </div>
                          <InlineScheduleEditor
                            catalog={catalog}
                            className="group-schedule-editor"
                            disabled={disabled}
                            entry={entry}
                            onUpdate={onUpdateEntry}
                          />
                        </article>
                      ))}
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

export function entryBelongsToGroup(entry: ScheduleEntry, groupId: string) {
  if (!groupId) return false;
  const groupIds = entry.group_ids?.length ? entry.group_ids : [entry.group_id];
  return groupIds.map(String).includes(groupId);
}
