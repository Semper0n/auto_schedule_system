import { dayNames } from "../../constants";
import { trimTime } from "../../lib/dictionary";
import type { Catalog, Id, ScheduleEntry } from "../../types";
import { InlineScheduleEditor } from "./InlineScheduleEditor";

type ScheduleListTableProps = {
  catalog: Catalog;
  disabled: boolean;
  entries: ScheduleEntry[];
  onUpdateEntry: (entryId: number, data: Record<string, Id>) => void;
};

export function ScheduleListTable({ catalog, disabled, entries, onUpdateEntry }: ScheduleListTableProps) {
  return (
    <section className="schedule-table">
      <table>
        <thead>
          <tr>
            <th>Р”РµРЅСЊ</th>
            <th>РџР°СЂР°</th>
            <th>Р’СЂРµРјСЏ</th>
            <th>Р“СЂСѓРїРїР°</th>
            <th>Р”РёСЃС†РёРїР»РёРЅР°</th>
            <th>РџСЂРµРїРѕРґР°РІР°С‚РµР»СЊ</th>
            <th>РђСѓРґРёС‚РѕСЂРёСЏ</th>
            <th>РР·РјРµРЅРёС‚СЊ</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.entry_id}>
              <td>{dayNames[entry.day_of_week]}</td>
              <td>{entry.pair_number}</td>
              <td>{trimTime(entry.starts_at)}-{trimTime(entry.ends_at)}</td>
              <td>{entry.group_name}</td>
              <td>
                {entry.subject_name}
                <span>{entry.lesson_type_name}</span>
              </td>
              <td>{entry.teacher_name}</td>
              <td>
                {entry.classroom_name} ({entry.building_name})
              </td>
              <td>
                <InlineScheduleEditor catalog={catalog} disabled={disabled} entry={entry} onUpdate={onUpdateEntry} />
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={8}>РџРѕРєР° РЅРµС‚ Р·Р°РЅСЏС‚РёР№. Р—Р°РїСѓСЃС‚РёС‚Рµ РіРµРЅРµСЂР°С†РёСЋ СЂР°СЃРїРёСЃР°РЅРёСЏ.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
