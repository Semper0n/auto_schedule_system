import { API_URL } from "../constants";
import { GroupScheduleGrid, entryBelongsToGroup } from "../components/schedule/GroupScheduleGrid";
import { ScheduleListTable } from "../components/schedule/ScheduleListTable";
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
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const isRenaming = editingVersionId === selectedVersionId;
  const selectedGroup = catalog.groups.find((group) => String(group.group_id) === selectedGroupId);
  const groupEntries = useMemo(
    () => entries.filter((entry) => entryBelongsToGroup(entry, selectedGroupId)),
    [entries, selectedGroupId],
  );

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
              Переименовать
            </button>
            <button className="danger" disabled={disabled} onClick={() => onDeleteVersion(selectedVersionId)} type="button">
              Удалить
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
            Сохранить
          </button>
          <button
            disabled={disabled}
            onClick={() => {
              setEditingVersionId(null);
              setVersionName(currentVersion.name);
            }}
            type="button"
          >
            Отмена
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
            Общий список
          </button>
          <button className={viewMode === "group" ? "active" : ""} onClick={() => setViewMode("group")} type="button">
            По группе
          </button>
        </div>
        {viewMode === "group" && (
          <label>
            <span>Группа</span>
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
        <ScheduleListTable catalog={catalog} disabled={disabled} entries={entries} onUpdateEntry={onUpdateEntry} />
      )}
    </div>
  );
}
