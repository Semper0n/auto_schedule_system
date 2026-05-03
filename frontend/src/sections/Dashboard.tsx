import type { Catalog, Semester, Version } from "../types";

type DashboardProps = {
  catalog: Catalog;
  versions: Version[];
  activeSemester?: Semester;
  onGenerate: () => void;
  onOpenSchedule: () => void;
};

export function Dashboard({ catalog, versions, activeSemester, onGenerate, onOpenSchedule }: DashboardProps) {
  const stats = [
    ["Преподаватели", catalog.teachers.length],
    ["Группы", catalog.groups.length],
    ["Дисциплины", catalog.subjects.length],
    ["Аудитории", catalog.classrooms.length],
    ["Поручения", catalog.assignments.length],
    ["Версии", versions.length],
  ];

  return (
    <div className="view-stack">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Активный семестр</p>
          <h2>{activeSemester?.name ?? "Не задан"}</h2>
          <p>
            Система хранит исходные данные, формализует ограничения, генерирует версии расписаний
            и рассчитывает показатели качества.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={onGenerate} type="button">
            Запустить генерацию
          </button>
          <button onClick={onOpenSchedule} type="button">
            Открыть расписание
          </button>
        </div>
      </section>

      <section className="metric-grid">
        {stats.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
    </div>
  );
}
