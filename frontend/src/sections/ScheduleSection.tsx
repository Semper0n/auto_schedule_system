import { API_URL, dayNames } from "../constants";
import { slotOptions, trimTime } from "../lib/dictionary";
import type { Catalog, Id, ScheduleEntry, Version } from "../types";
import { useEffect, useMemo, useState } from "react";

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
  onRenameVersion: (versionId: number, name: string) => void;
  onDeleteVersion: (versionId: number) => void;
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
  onRenameVersion,
  onDeleteVersion,
  onUpdateEntry,
}: ScheduleSectionProps) {
  const [versionName, setVersionName] = useState(currentVersion?.name ?? "");
  const [editingVersionId, setEditingVersionId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "group">("list");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const isRenaming = editingVersionId === selectedVersionId;
  const selectedGroup = catalog.groups.find((group) => String(group.group_id) === selectedGroupId);
  const groupEntries = useMemo(
    () => entries.filter((entry) => entryBelongsToGroup(entry, selectedGroupId)),
    [entries, selectedGroupId],
  );
  const displayedEntries = viewMode === "group" ? groupEntries : entries;

  useEffect(() => {
    setVersionName(currentVersion?.name ?? "");
    setEditingVersionId(null);
  }, [currentVersion?.version_id, currentVersion?.name]);

  useEffect(() => {
    setSelectedGroupId((current) => (
      catalog.groups.some((group) => String(group.group_id) === current)
        ? current
        : String(catalog.groups[0]?.group_id ?? "")
    ));
  }, [catalog.groups]);

  function saveVersionName() {
    if (!currentVersion || !versionName.trim()) return;
    onRenameVersion(currentVersion.version_id, versionName.trim());
    setEditingVersionId(null);
  }

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
          <>
            <button
              disabled={disabled}
              onClick={() => {
                setEditingVersionId(selectedVersionId);
                setVersionName(currentVersion?.name ?? "");
              }}
              type="button"
            >
              {"\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c"}
            </button>
            <button className="danger" disabled={disabled} onClick={() => onDeleteVersion(selectedVersionId)} type="button">
              {"\u0423\u0434\u0430\u043b\u0438\u0442\u044c"}
            </button>
          </>
        )}
        {selectedVersionId && (
          <a
            className="button-link"
            href={`${API_URL}/schedule/versions/${selectedVersionId}/export.csv?token=${encodeURIComponent(authToken)}`}
          >
            CSV
          </a>
        )}
      </section>

      {currentVersion && isRenaming && (
        <section className="version-editor">
          <input
            autoFocus
            onChange={(event) => setVersionName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveVersionName();
              if (event.key === "Escape") {
                setEditingVersionId(null);
                setVersionName(currentVersion.name);
              }
            }}
            value={versionName}
          />
          <button className="primary" disabled={disabled || !versionName.trim()} onClick={saveVersionName} type="button">
            {"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}
          </button>
          <button
            disabled={disabled}
            onClick={() => {
              setEditingVersionId(null);
              setVersionName(currentVersion.name);
            }}
            type="button"
          >
            {"\u041e\u0442\u043c\u0435\u043d\u0430"}
          </button>
        </section>
      )}

      {currentVersion && (
        <section className="quality-row">
          <span>Статус: {currentVersion.status}</span>
          <span>Конфликты: {currentVersion.conflicts_count}</span>
          <span>Окна: {currentVersion.gaps_count}</span>
          <span>Предпочтения: {currentVersion.preference_score}</span>
        </section>
      )}

      <section className="schedule-view-toolbar">
        <div className="segmented-control">
          <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} type="button">
            {"\u041e\u0431\u0449\u0438\u0439 \u0441\u043f\u0438\u0441\u043e\u043a"}
          </button>
          <button className={viewMode === "group" ? "active" : ""} onClick={() => setViewMode("group")} type="button">
            {"\u041f\u043e \u0433\u0440\u0443\u043f\u043f\u0435"}
          </button>
        </div>
        {viewMode === "group" && (
          <label>
            <span>{"\u0413\u0440\u0443\u043f\u043f\u0430"}</span>
            <select disabled={catalog.groups.length === 0} onChange={(event) => setSelectedGroupId(event.target.value)} value={selectedGroupId}>
              {catalog.groups.map((group) => (
                <option key={group.group_id} value={group.group_id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {viewMode === "group" ? (
        <GroupScheduleGrid
          catalog={catalog}
          disabled={disabled}
          entries={groupEntries}
          groupName={selectedGroup?.name ?? ""}
          onUpdateEntry={onUpdateEntry}
        />
      ) : (
      <section className="schedule-table">
        <table>
          <thead>
            <tr>
              <th>День</th>
              <th>Пара</th>
              <th>Время</th>
              <th>Группа</th>
              <th>Дисциплина</th>
              <th>Преподаватель</th>
              <th>Аудитория</th>
              <th>Изменить</th>
            </tr>
          </thead>
          <tbody>
            {displayedEntries.map((entry) => (
              <tr key={entry.entry_id}>
                <td>{dayNames[entry.day_of_week]}</td>
                <td>
                  {entry.pair_number}
                </td>
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
                  <InlineEditor catalog={catalog} entry={entry} disabled={disabled} onUpdate={onUpdateEntry} />
                </td>
              </tr>
            ))}
            {displayedEntries.length === 0 && (
              <tr>
                <td colSpan={8}>Пока нет занятий. Запустите генерацию расписания.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      )}
    </div>
  );
}

function GroupScheduleGrid({
  catalog,
  disabled,
  entries,
  groupName,
  onUpdateEntry,
}: {
  catalog: Catalog;
  disabled: boolean;
  entries: ScheduleEntry[];
  groupName: string;
  onUpdateEntry: (entryId: number, data: Record<string, Id>) => void;
}) {
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
                          <InlineEditor
                            className="group-schedule-editor"
                            catalog={catalog}
                            entry={entry}
                            disabled={disabled}
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

function entryBelongsToGroup(entry: ScheduleEntry, groupId: string) {
  if (!groupId) return false;
  const groupIds = entry.group_ids?.length ? entry.group_ids : [entry.group_id];
  return groupIds.map(String).includes(groupId);
}

function InlineEditor({
  className = "",
  catalog,
  entry,
  disabled,
  onUpdate,
}: {
  className?: string;
  catalog: Catalog;
  entry: ScheduleEntry;
  disabled: boolean;
  onUpdate: (entryId: number, data: Record<string, Id>) => void;
}) {
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
