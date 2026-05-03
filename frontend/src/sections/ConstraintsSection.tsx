import { DictionaryPage, type ResourceHandlers } from "../components/DictionaryPage";
import { buildConstraintConfigs } from "../lib/dictionary";
import type { Catalog, ConstraintKey } from "../types";

type ConstraintsSectionProps = ResourceHandlers & {
  activeConstraint: ConstraintKey;
  catalog: Catalog;
  disabled: boolean;
};

export function ConstraintsSection({
  activeConstraint,
  catalog,
  disabled,
  onCreate,
  onImport,
  onUpdate,
  onDelete,
}: ConstraintsSectionProps) {
  const config = buildConstraintConfigs(catalog).find((item) => item.key === activeConstraint);

  if (!config) {
    return null;
  }

  return (
    <DictionaryPage
      config={config}
      disabled={disabled}
      onCreate={onCreate}
      onDelete={onDelete}
      onImport={onImport}
      onUpdate={onUpdate}
    />
  );
}
