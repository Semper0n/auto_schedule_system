import { API_URL, dayNames } from "../constants";
import { slotOptions, trimTime } from "../lib/dictionary";
import type { Catalog, Id, ScheduleEntry, Version } from "../types";
import { useState } from "react";

type ScheduleSectionProps = {
  catalog: Catalog;
  entries: ScheduleEntry[];
  authToken: string;
  selectedVersionId: number | null;
  versions: Version[];
  currentVersion?: Version;
  disabled: boolean;
  onSelectVersion: (versionId: number) => void;
  onGenerate: () => void;
  onValidate: () => void;
  onActivate: (versionId: number) => void;
  onUpdateEntry: (entryId: number, data: Record<string, Id>) => void;
};

export function ScheduleSection({
  catalog,
  entries,
  authToken,
  selectedVersionId,
  versions,
  currentVersion,
  disabled,
  onSelectVersion,
  onGenerate,
  onValidate,
  onActivate,
  onUpdateEntry,
}: ScheduleSectionProps) {
  return (
    <div className="view-stack">
      <section className="toolbar">
        <select
          disabled={versions.length === 0}
          onChange={(event) => onSelectVersion(Number(event.target.value))}
          value={selectedVersionId ?? ""}
        >
          <option value="">Нет версий</option>
          {versions.map((version) => (
            <option key={version.version_id} value={version.version_id}>
              {version.name}
            </option>
          ))}
        </select>
        <button className="primary" disabled={disabled} onClick={onGenerate} type="button">
          Сгенерировать
        </button>
        <button disabled={!selectedVersionId || disabled} onClick={onValidate} type="button">
          Проверить
        </button>
        <button
          disabled={!selectedVersionId || disabled}
          onClick={() => selectedVersionId && onActivate(selectedVersionId)}
          type="button"
        >
          Сделать активной
        </button>
        {selectedVersionId && (
          <a
            className="button-link"
            href={`${API_URL}/schedule/versions/${selectedVersionId}/export.csv?token=${encodeURIComponent(authToken)}`}
          >
            CSV
          </a>
        )}
      </section>

      {currentVersion && (
        <section className="quality-row">
          <span>Статус: {currentVersion.status}</span>
          <span>Конфликты: {currentVersion.conflicts_count}</span>
          <span>Окна: {currentVersion.gaps_count}</span>
          <span>Предпочтения: {currentVersion.preference_score}</span>
        </section>
      )}

      <section className="schedule-table">
        <table>
          <thead>
            <tr>
              <th>День</th>
              <th>Пара</th>
              <th>Группа</th>
              <th>Дисциплина</th>
              <th>Преподаватель</th>
              <th>Аудитория</th>
              <th>Изменить</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.entry_id}>
                <td>{dayNames[entry.day_of_week]}</td>
                <td>
                  {entry.pair_number} · {trimTime(entry.starts_at)}
                </td>
                <td>{entry.group_name}</td>
                <td>
                  {entry.subject_name}
                  <span>{entry.lesson_type_name}</span>
                </td>
                <td>{entry.teacher_name}</td>
                <td>
                  {entry.building_name} {entry.classroom_name}
                </td>
                <td>
                  <InlineEditor catalog={catalog} entry={entry} disabled={disabled} onUpdate={onUpdateEntry} />
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7}>Пока нет занятий. Запустите генерацию расписания.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function InlineEditor({
  catalog,
  entry,
  disabled,
  onUpdate,
}: {
  catalog: Catalog;
  entry: ScheduleEntry;
  disabled: boolean;
  onUpdate: (entryId: number, data: Record<string, Id>) => void;
}) {
  const [timeSlotId, setTimeSlotId] = useState(entry.time_slot_id);
  const [classroomId, setClassroomId] = useState(entry.classroom_id);

  return (
    <div className="inline-editor">
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
