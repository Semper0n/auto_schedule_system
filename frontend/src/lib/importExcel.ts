import * as XLSX from "xlsx";
import type { DictionaryConfig, FieldConfig, RowData, RowValue } from "../types";

export async function readImportRows(file: File, config: DictionaryConfig) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    defval: "",
    header: 1,
    raw: false,
  });

  return rows.map((row) => importRowToBody(row, config.fields)).filter((row) => hasImportValues(row));
}

function importRowToBody(row: unknown[], fields: FieldConfig[]) {
  const entries = fields
    .map((fieldConfig, index) => [fieldConfig.name, normalizeImportValue(row[index], fieldConfig)] as const)
    .filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as RowData;
}

function normalizeImportValue(value: unknown, fieldConfig: FieldConfig): RowValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const text = String(value).trim();
  if (text === "") {
    return undefined;
  }

  if (fieldConfig.type === "multiselect") {
    return text
      .split(/[,;]+/)
      .map((item) => normalizeSelectValue(item, fieldConfig))
      .filter((item): item is string => Boolean(item));
  }

  if (fieldConfig.type === "select") {
    return normalizeSelectValue(text, fieldConfig);
  }

  if (fieldConfig.type === "checkbox") {
    return ["1", "true", "yes", "??", "??????", "????????"].includes(text.toLowerCase());
  }

  if (fieldConfig.type === "date") {
    return text.slice(0, 10);
  }

  if (fieldConfig.type === "time") {
    return text.slice(0, 5);
  }

  if (fieldConfig.type === "number") {
    const normalizedNumber = Number(text.replace(",", "."));
    return Number.isFinite(normalizedNumber) ? normalizedNumber : text;
  }

  return text;
}

function normalizeSelectValue(value: string, fieldConfig: FieldConfig) {
  const text = value.trim();
  if (text === "") return "";
  const option = fieldConfig.options?.find((item) => {
    const optionValue = String(item[fieldConfig.valueKey ?? "value"]).trim();
    const optionLabel = String(item[fieldConfig.labelKey ?? "label"]).trim();
    return optionValue === text || optionLabel.toLowerCase() === text.toLowerCase();
  });
  return option ? String(option[fieldConfig.valueKey ?? "value"]) : text;
}
function hasImportValues(row: RowData) {
  return Object.values(row).some((value) => Array.isArray(value) ? value.length > 0 : value !== "" && value !== null && value !== false);
}
