import type { ChangeEvent } from "react";
import { normalizeInputValue } from "../lib/dictionary";
import type { FieldConfig, RowValue } from "../types";

type FieldInputProps = {
  field: FieldConfig;
  value: RowValue;
  isDefault?: boolean;
  onChange?: (value: RowValue) => void;
};

export function FieldInput({ field, value, isDefault = false, onChange }: FieldInputProps) {
  if (field.type === "select") {
    const props = isDefault
      ? { defaultValue: String(value ?? "") }
      : { value: String(value ?? ""), onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange?.(event.target.value) };
    return (
      <select name={field.name} required={field.required !== false} {...props}>
        <option value="" disabled={field.required !== false}>
          {field.required === false ? "Не выбрано" : "Выберите значение"}
        </option>
        {(field.options ?? []).map((option) => (
          <option key={String(option[field.valueKey ?? "value"])} value={String(option[field.valueKey ?? "value"])}>
            {String(option[field.labelKey ?? "label"])}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    const props = isDefault
      ? { defaultChecked: Boolean(value) }
      : { checked: Boolean(value), onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.checked) };
    return <input name={field.name} type="checkbox" {...props} />;
  }

  const inputValue = normalizeInputValue(value, field.type);
  const props = isDefault
    ? { defaultValue: inputValue }
    : { value: inputValue, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value) };

  return (
    <input
      name={field.name}
      required={field.required !== false}
      type={field.type ?? "text"}
      {...props}
    />
  );
}
