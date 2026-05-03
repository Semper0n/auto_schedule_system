import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FieldInput } from "./FieldInput";
import {
  createDraft,
  emptyBody,
  fieldsToBody,
  formatValue,
  rowSubtitle,
  rowTitle,
} from "../lib/dictionary";
import { readImportRows } from "../lib/importExcel";
import type { DictionaryConfig, RowData } from "../types";

export type ResourceHandlers = {
  onCreate: (resource: string, body: RowData) => void;
  onImport: (resource: string, rows: RowData[]) => Promise<void>;
  onUpdate: (resource: string, id: number, body: RowData) => void;
  onDelete: (resource: string, id: number) => void;
};

type DictionaryPageProps = ResourceHandlers & {
  config: DictionaryConfig;
  disabled: boolean;
};

export function DictionaryPage({ config, disabled, onCreate, onImport, onUpdate, onDelete }: DictionaryPageProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [draft, setDraft] = useState<RowData>(() => emptyBody(config.fields));
  const [isImporting, setIsImporting] = useState(false);

  const selectedRow = config.rows.find((row) => Number(row[config.idKey]) === selectedId);
  const isEditing = mode === "create" || mode === "edit";
  const canUseSelected = selectedId !== null && Boolean(selectedRow) && !disabled;

  useEffect(() => {
    setSelectedId(null);
    setMode("view");
    setDraft(emptyBody(config.fields));
  }, [config.key, config.fields]);

  function selectRow(row: RowData) {
    if (isEditing) return;
    setSelectedId(Number(row[config.idKey]));
  }

  function startCreate() {
    setSelectedId(null);
    setMode("create");
    setDraft(createDraft(config));
  }

  function startEdit() {
    if (!selectedRow) return;
    setMode("edit");
    setDraft(fieldsToBody(selectedRow, config.fields));
  }

  function cancel() {
    setMode("view");
    setDraft(emptyBody(config.fields));
  }

  function save() {
    if (mode === "create") {
      onCreate(config.resource, draft);
      cancel();
      return;
    }

    if (mode === "edit" && selectedId !== null) {
      onUpdate(config.resource, selectedId, draft);
      cancel();
    }
  }

  function remove() {
    if (selectedId !== null) {
      onDelete(config.resource, selectedId);
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const rows = await readImportRows(file, config);
      await onImport(config.resource, rows);
    } catch {
      // The page-level import handler already shows the error message.
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="directory-layout">
      <section className="directory-panel">
        <header className="directory-header">
          <div>
            <p className="eyebrow">Справочник</p>
            <h2>{config.title}</h2>
          </div>
          <div className="directory-header-actions">
            <span>{config.rows.length}</span>
            <button
              disabled={disabled || isEditing || isImporting}
              onClick={() => importInputRef.current?.click()}
              type="button"
            >
              Импорт
            </button>
            <input
              accept=".xlsx,.xls,.csv"
              className="visually-hidden"
              onChange={importFile}
              ref={importInputRef}
              type="file"
            />
          </div>
        </header>

        <div className="control-panel">
          <button className="primary" disabled={disabled || isEditing} onClick={startCreate} type="button">
            Добавить
          </button>
          <button disabled={!canUseSelected || isEditing} onClick={startEdit} type="button">
            Изменить
          </button>
          <button className="danger" disabled={!canUseSelected || isEditing} onClick={remove} type="button">
            Удалить
          </button>
          <button className="primary" disabled={disabled || !isEditing} onClick={save} type="button">
            Сохранить
          </button>
          <button disabled={disabled || !isEditing} onClick={cancel} type="button">
            Отмена
          </button>
        </div>

        <div className="directory-body">
          {config.key === "timeSlots" ? (
            <div className="directory-list directory-table-list">
              <div className="table-scroll">
                <table className="slot-template-table">
                  <thead>
                    <tr>
                      {config.fields.map((item) => (
                        <th key={item.name}>{item.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {config.rows.map((row) => {
                      const id = Number(row[config.idKey]);
                      const isSelected = selectedId === id;
                      return (
                        <tr className={isSelected ? "selected" : ""} key={id} onClick={() => selectRow(row)}>
                          {config.fields.map((item) => (
                            <td key={item.name}>{formatValue(row[item.name], item)}</td>
                          ))}
                        </tr>
                      );
                    })}
                    {config.rows.length === 0 && (
                      <tr>
                        <td colSpan={config.fields.length}>Записей пока нет.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="directory-list" role="listbox">
              {config.rows.map((row) => {
                const id = Number(row[config.idKey]);
                const isSelected = selectedId === id;
                return (
                  <button
                    className={isSelected ? "selected" : ""}
                    disabled={isEditing}
                    key={id}
                    onClick={() => selectRow(row)}
                    type="button"
                  >
                    <strong>{rowTitle(row, config.fields)}</strong>
                    <span>{rowSubtitle(row, config.fields)}</span>
                  </button>
                );
              })}
              {config.rows.length === 0 && <p className="empty-note">Записей пока нет.</p>}
            </div>
          )}

          <div className="editor-panel">
            {isEditing ? (
              <div className="editor-form">
                {config.fields.map((item) => (
                  <label key={item.name}>
                    <span>{item.label}</span>
                    <FieldInput
                      field={item}
                      value={draft[item.name] ?? ""}
                      onChange={(value) => setDraft((current) => ({ ...current, [item.name]: value }))}
                    />
                  </label>
                ))}
              </div>
            ) : selectedRow ? (
              <dl className="record-details">
                {config.fields.map((item) => (
                  <div key={item.name}>
                    <dt>{item.label}</dt>
                    <dd>{formatValue(selectedRow[item.name], item)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="empty-state">
                <h3>Выберите запись</h3>
                <p>После выбора записи станут доступны кнопки изменения и удаления.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
