import { DictionaryPage, type ResourceHandlers } from "../components/DictionaryPage";
import { buildDictionaryConfigs } from "../lib/dictionary";
import type { Catalog, DictionaryKey } from "../types";

type DataSectionProps = ResourceHandlers & {
  activeDictionary: DictionaryKey;
  catalog: Catalog;
  disabled: boolean;
};

export function DataSection({ activeDictionary, catalog, disabled, onCreate, onImport, onUpdate, onDelete }: DataSectionProps) {
  const config = buildDictionaryConfigs(catalog).find((item) => item.key === activeDictionary);

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
