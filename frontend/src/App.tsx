import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import * as XLSX from "xlsx";

const API_URL = "http://localhost:3000/api";

type Id = number | string | boolean;
type RowValue = Id | null;
type RowData = Record<string, RowValue>;

type AuthUser = {
  user_id: number;
  username: string;
  role: string;
  token: string;
};

type Catalog = {
  departments: Department[];
  semesters: Semester[];
  teachers: Teacher[];
  groups: StudentGroup[];
  subjects: Subject[];
  lessonTypes: LessonType[];
  buildings: Building[];
  classrooms: Classroom[];
  timeSlots: TimeSlot[];
  assignments: Assignment[];
  teacherUnavailability: TeacherUnavailability[];
  groupUnavailability: GroupUnavailability[];
  classroomUnavailability: ClassroomUnavailability[];
  teacherPreferences: TeacherPreference[];
};

type Department = RowData & { department_id: number; name: string };
type Semester = RowData & { semester_id: number; name: string; starts_on: string; ends_on: string; is_active: boolean };
type Teacher = RowData & {
  teacher_id: number;
  department_id: number | null;
  full_name: string;
  position: string | null;
  max_hours_per_week: number;
  notes: string | null;
};
type StudentGroup = RowData & {
  group_id: number;
  department_id: number | null;
  name: string;
  course: number;
  students_count: number;
};
type Subject = RowData & { subject_id: number; department_id: number | null; name: string; total_hours: number };
type LessonType = RowData & { lesson_type_id: number; name: string };
type Building = RowData & { building_id: number; name: string; address: string | null };
type Classroom = RowData & {
  classroom_id: number;
  building_id: number | null;
  name: string;
  capacity: number;
  equipment: string | null;
};
type TimeSlot = RowData & {
  time_slot_id: number;
  day_of_week: number;
  pair_number: number;
  starts_at: string;
  ends_at: string;
};
type TimeSlotTemplate = RowData & {
  pair_number: number;
  starts_at: string;
  ends_at: string;
};
type Assignment = RowData & {
  assignment_id: number;
  semester_id: number;
  teacher_id: number;
  subject_id: number;
  group_id: number;
  lesson_type_id: number;
  hours_per_week: number;
  classroom_capacity_required: number;
  teacher_name: string;
  subject_name: string;
  group_name: string;
  lesson_type_name: string;
};
type TeacherUnavailability = RowData & {
  unavailable_id: number;
  teacher_id: number;
  time_slot_id: number;
  reason: string | null;
  teacher_name: string;
  day_of_week: number;
  pair_number: number;
};
type GroupUnavailability = RowData & {
  unavailable_id: number;
  group_id: number;
  time_slot_id: number;
  reason: string | null;
  group_name: string;
  day_of_week: number;
  pair_number: number;
};
type ClassroomUnavailability = RowData & {
  unavailable_id: number;
  classroom_id: number;
  time_slot_id: number;
  reason: string | null;
  classroom_name: string;
  day_of_week: number;
  pair_number: number;
};
type TeacherPreference = RowData & {
  preference_id: number;
  teacher_id: number;
  time_slot_id: number;
  preference: string;
  weight: number;
  teacher_name: string;
  day_of_week: number;
  pair_number: number;
};
type Version = {
  version_id: number;
  semester_id: number;
  semester_name: string;
  name: string;
  status: string;
  conflicts_count: number;
  gaps_count: number;
  preference_score: number;
  created_at: string;
};
type ScheduleEntry = {
  entry_id: number;
  time_slot_id: number;
  classroom_id: number;
  day_of_week: number;
  pair_number: number;
  starts_at: string;
  ends_at: string;
  teacher_name: string;
  group_name: string;
  subject_name: string;
  lesson_type_name: string;
  classroom_name: string;
  building_name: string | null;
};

type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "checkbox";
  defaultValue?: RowValue;
  options?: Record<string, unknown>[];
  valueKey?: string;
  labelKey?: string;
  required?: boolean;
  readOnly?: boolean;
};

const emptyCatalog: Catalog = {
  departments: [],
  semesters: [],
  teachers: [],
  groups: [],
  subjects: [],
  lessonTypes: [],
  buildings: [],
  classrooms: [],
  timeSlots: [],
  assignments: [],
  teacherUnavailability: [],
  groupUnavailability: [],
  classroomUnavailability: [],
  teacherPreferences: [],
};

const dayNames: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

const sections = [
  { id: "dashboard", label: "Обзор" },
  { id: "data", label: "Данные" },
  { id: "constraints", label: "Ограничения" },
  { id: "schedule", label: "Расписание" },
] as const;

type Section = (typeof sections)[number]["id"];
type DictionaryKey =
  | "departments"
  | "semesters"
  | "teachers"
  | "groups"
  | "subjects"
  | "lessonTypes"
  | "buildings"
  | "classrooms"
  | "timeSlots"
  | "assignments";
type ConstraintKey =
  | "teacherUnavailability"
  | "teacherPreferences"
  | "classroomUnavailability"
  | "groupUnavailability";

type DictionaryConfig = {
  key: DictionaryKey | ConstraintKey;
  title: string;
  resource: string;
  idKey: string;
  rows: RowData[];
  fields: FieldConfig[];
};

const dictionaryMenu: Array<{ key: DictionaryKey; label: string }> = [
  { key: "semesters", label: "Семестры" },
  { key: "buildings", label: "Корпуса" },
  { key: "departments", label: "Кафедры" },

  { key: "teachers", label: "Преподаватели" },
  { key: "groups", label: "Учебные группы" },
  { key: "subjects", label: "Дисциплины" },
  { key: "lessonTypes", label: "Типы занятий" },

  { key: "classrooms", label: "Аудитории" },
  { key: "timeSlots", label: "Временные слоты" },
  { key: "assignments", label: "Учебные поручения" },
];

const constraintMenu: Array<{ key: ConstraintKey; label: string }> = [
  { key: "teacherUnavailability", label: "Недоступность преподавателей" },
  { key: "teacherPreferences", label: "Предпочтения преподавателей" },
  { key: "classroomUnavailability", label: "Недоступность аудиторий" },
  { key: "groupUnavailability", label: "Недоступность групп" },
];

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const stored = window.localStorage.getItem("schedule-auth-user");
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      window.localStorage.removeItem("schedule-auth-user");
      return null;
    }
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [activeDictionary, setActiveDictionary] = useState<DictionaryKey>("teachers");
  const [activeConstraint, setActiveConstraint] = useState<ConstraintKey>("teacherUnavailability");
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [message, setMessage] = useState("Загрузка данных...");
  const [isBusy, setIsBusy] = useState(false);

  const activeSemester = useMemo(
    () => catalog.semesters.find((semester) => semester.is_active) ?? catalog.semesters[0],
    [catalog.semesters],
  );

  function saveAuth(user: AuthUser) {
    window.localStorage.setItem("schedule-auth-user", JSON.stringify(user));
    setAuthUser(user);
  }

  function clearAuth() {
    window.localStorage.removeItem("schedule-auth-user");
    setAuthUser(null);
    setCatalog(emptyCatalog);
    setVersions([]);
    setEntries([]);
    setSelectedVersionId(null);
  }

  async function request<T>(path: string, options?: RequestInit, token = authUser?.token): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => ({}))
        : { error: await response.text().catch(() => "") };
      if (response.status === 401 && !path.startsWith("/auth/")) {
        clearAuth();
      }
      throw new Error(data.error || `Не удалось выполнить запрос (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async function loadAll(nextVersionId = selectedVersionId, token = authUser?.token) {
    const [catalogData, versionData] = await Promise.all([
      request<Catalog>("/catalog", undefined, token),
      request<Version[]>("/schedule/versions", undefined, token),
    ]);
    setCatalog(catalogData);
    setVersions(versionData);

    const versionId = nextVersionId ?? versionData[0]?.version_id ?? null;
    setSelectedVersionId(versionId);
    if (versionId) {
      const schedule = await request<{ entries: ScheduleEntry[] }>(`/schedule/versions/${versionId}`, undefined, token);
      setEntries(schedule.entries);
    } else {
      setEntries([]);
    }
    setMessage("Система готова к работе");
  }

  useEffect(() => {
    if (authUser) {
      loadAll().catch((error) => setMessage(error.message));
    } else {
      setMessage("Войдите в систему");
    }
  }, [authUser?.token]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    try {
      const user = await request<AuthUser>(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(authForm),
      });
      saveAuth(user);
      setAuthForm({ username: "", password: "" });
      try {
        await loadAll(undefined, user.token);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Пользователь создан, но данные не загрузились");
        return;
      }
      setMessage(authMode === "login" ? "Вход выполнен" : "Регистрация выполнена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка авторизации");
    } finally {
      setIsBusy(false);
    }
  }

  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // Local logout should still work if the server is unavailable.
    } finally {
      clearAuth();
      setMessage("Вы вышли из системы");
    }
  }

  async function createResource(resource: string, body: RowData) {
    setIsBusy(true);
    try {
      await request(`/${resource}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await loadAll();
      setMessage("Запись сохранена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsBusy(false);
    }
  }

  async function importResources(resource: string, rows: RowData[]) {
    if (rows.length === 0) {
      setMessage("В файле нет строк для импорта");
      return;
    }

    setIsBusy(true);
    try {
      const preparedRows = await prepareImportRows(resource, rows);
      for (const row of preparedRows) {
        await request(`/${resource}`, {
          method: "POST",
          body: JSON.stringify(row),
        });
      }
      await loadAll();
      setMessage(`Импортировано записей: ${preparedRows.length}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка импорта");
      throw error;
    } finally {
      setIsBusy(false);
    }
  }

  async function prepareImportRows(resource: string, rows: RowData[]) {
    if (!["teachers", "groups", "subjects"].includes(resource)) {
      return rows;
    }

    const departments = [...catalog.departments];
    const preparedRows: RowData[] = [];

    for (const row of rows) {
      const nextRow = { ...row };
      const departmentValue = nextRow.department_id;
      if (typeof departmentValue === "string" && departmentValue.trim() !== "" && Number.isNaN(Number(departmentValue))) {
        const departmentName = departmentValue.trim();
        let department = departments.find((item) => item.name.toLowerCase() === departmentName.toLowerCase());
        if (!department) {
          department = await request<Department>("/departments", {
            method: "POST",
            body: JSON.stringify({ name: departmentName }),
          });
          departments.push(department);
        }
        nextRow.department_id = department.department_id;
      }
      preparedRows.push(nextRow);
    }

    return preparedRows;
  }

  async function updateResource(resource: string, id: number, body: RowData) {
    setIsBusy(true);
    try {
      await request(`/${resource}/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await loadAll();
      setMessage("Запись обновлена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка обновления");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteResource(resource: string, id: number) {
    const confirmed = window.confirm("Удалить запись? Если она используется в расписании или поручениях, система не позволит удалить её.");
    if (!confirmed) return;

    setIsBusy(true);
    try {
      await request(`/${resource}/${id}`, { method: "DELETE" });
      await loadAll();
      setMessage("Запись удалена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка удаления");
    } finally {
      setIsBusy(false);
    }
  }

  async function generateSchedule() {
    if (!activeSemester) {
      setMessage("Сначала добавьте семестр");
      return;
    }

    setIsBusy(true);
    try {
      const result = await request<{ version: Version; metrics: { conflicts_count: number } }>(
        "/schedule/generate",
        {
          method: "POST",
          body: JSON.stringify({
            semester_id: activeSemester.semester_id,
            name: `Автоматическое расписание ${new Date().toLocaleDateString("ru-RU")}`,
          }),
        },
      );
      await loadAll(result.version.version_id);
      setActiveSection("schedule");
      setMessage(
        result.metrics.conflicts_count === 0
          ? "Расписание сгенерировано без конфликтов"
          : `Расписание создано, требуется проверить ${result.metrics.conflicts_count} конфликтов`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка генерации");
    } finally {
      setIsBusy(false);
    }
  }

  async function activateVersion(versionId: number) {
    setIsBusy(true);
    try {
      await request(`/schedule/versions/${versionId}/activate`, { method: "POST" });
      await loadAll(versionId);
      setMessage("Версия расписания сделана активной");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка активации версии");
    } finally {
      setIsBusy(false);
    }
  }

  async function validateVersion() {
    if (!selectedVersionId) return;
    setIsBusy(true);
    try {
      const metrics = await request<{ conflicts_count: number; gaps_count: number; preference_score: number }>(
        `/schedule/versions/${selectedVersionId}/validate`,
      );
      await loadAll(selectedVersionId);
      setMessage(
        `Проверка: конфликтов ${metrics.conflicts_count}, окон ${metrics.gaps_count}, оценка предпочтений ${metrics.preference_score}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка проверки");
    } finally {
      setIsBusy(false);
    }
  }

  async function updateEntry(entryId: number, data: Record<string, Id>) {
    setIsBusy(true);
    try {
      await request(`/schedule/entries/${entryId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (selectedVersionId) {
        const schedule = await request<{ entries: ScheduleEntry[] }>(`/schedule/versions/${selectedVersionId}`);
        setEntries(schedule.entries);
      }
      setMessage("Занятие обновлено, запустите проверку ограничений");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка изменения занятия");
    } finally {
      setIsBusy(false);
    }
  }

  const currentVersion = versions.find((version) => version.version_id === selectedVersionId);

  if (!authUser) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">ВКР / практика</p>
            <h1>Автоматическое составление расписаний</h1>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            <div className="auth-tabs">
              <button
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
                type="button"
              >
                Вход
              </button>
              <button
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
                type="button"
              >
                Регистрация
              </button>
            </div>
            <label>
              <span>Логин</span>
              <input
                autoComplete="username"
                minLength={3}
                onChange={(event) => setAuthForm((current) => ({ ...current, username: event.target.value }))}
                required
                type="text"
                value={authForm.username}
              />
            </label>
            <label>
              <span>Пароль</span>
              <input
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                minLength={authMode === "register" ? 6 : undefined}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                required
                type="password"
                value={authForm.password}
              />
            </label>
            <button className="primary" disabled={isBusy} type="submit">
              {authMode === "login" ? "Войти" : "Создать пользователя"}
            </button>
            <p className="auth-message">{message}</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">ВКР / практика</p>
          <h1>Автоматическое составление расписаний</h1>
        </div>

        <nav className="nav">
          {sections.map((section) => (
            <div className="nav-group" key={section.id}>
              <button
                className={activeSection === section.id ? "active" : ""}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                {section.label}
              </button>
              {section.id === "data" && activeSection === "data" && (
                <div className="subnav">
                  {dictionaryMenu.map((item) => (
                    <button
                      className={activeDictionary === item.key ? "active" : ""}
                      key={item.key}
                      onClick={() => setActiveDictionary(item.key)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {section.id === "constraints" && activeSection === "constraints" && (
                <div className="subnav">
                  {constraintMenu.map((item) => (
                    <button
                      className={activeConstraint === item.key ? "active" : ""}
                      key={item.key}
                      onClick={() => setActiveConstraint(item.key)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="status-box">
          <span className={isBusy ? "pulse" : "dot"} />
          <p>
            {authUser.username} · {message}
          </p>
        </div>
        <button className="logout-button" onClick={logout} type="button">
          Выйти
        </button>
      </aside>

      <section className="workspace">
        {activeSection === "dashboard" && (
          <Dashboard
            catalog={catalog}
            versions={versions}
            activeSemester={activeSemester}
            onGenerate={generateSchedule}
            onOpenSchedule={() => setActiveSection("schedule")}
          />
        )}

        {activeSection === "data" && (
          <DataSection
            activeDictionary={activeDictionary}
            catalog={catalog}
            disabled={isBusy}
            onCreate={createResource}
            onDelete={deleteResource}
            onImport={importResources}
            onUpdate={updateResource}
          />
        )}

        {activeSection === "constraints" && (
          <ConstraintsSection
            activeConstraint={activeConstraint}
            catalog={catalog}
            disabled={isBusy}
            onCreate={createResource}
            onDelete={deleteResource}
            onImport={importResources}
            onUpdate={updateResource}
          />
        )}

        {activeSection === "schedule" && (
          <ScheduleSection
            catalog={catalog}
            entries={entries}
            authToken={authUser.token}
            selectedVersionId={selectedVersionId}
            versions={versions}
            currentVersion={currentVersion}
            disabled={isBusy}
            onSelectVersion={async (versionId) => {
              setSelectedVersionId(versionId);
              const schedule = await request<{ entries: ScheduleEntry[] }>(`/schedule/versions/${versionId}`);
              setEntries(schedule.entries);
            }}
            onGenerate={generateSchedule}
            onValidate={validateVersion}
            onActivate={activateVersion}
            onUpdateEntry={updateEntry}
          />
        )}
      </section>
    </main>
  );
}

function Dashboard({
  catalog,
  versions,
  activeSemester,
  onGenerate,
  onOpenSchedule,
}: {
  catalog: Catalog;
  versions: Version[];
  activeSemester?: Semester;
  onGenerate: () => void;
  onOpenSchedule: () => void;
}) {
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

function DataSection({
  activeDictionary,
  catalog,
  disabled,
  onCreate,
  onImport,
  onUpdate,
  onDelete,
}: ResourceHandlers & { activeDictionary: DictionaryKey; catalog: Catalog; disabled: boolean }) {
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

type ResourceHandlers = {
  onCreate: (resource: string, body: RowData) => void;
  onImport: (resource: string, rows: RowData[]) => Promise<void>;
  onUpdate: (resource: string, id: number, body: RowData) => void;
  onDelete: (resource: string, id: number) => void;
};

function DictionaryPage({
  config,
  disabled,
  onCreate,
  onImport,
  onUpdate,
  onDelete,
}: ResourceHandlers & { config: DictionaryConfig; disabled: boolean }) {
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
  }, [config.key]);

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

function buildDictionaryConfigs(catalog: Catalog): DictionaryConfig[] {
  const departmentField = selectField("department_id", "Кафедра", catalog.departments, "department_id", "name", false);
  const buildingField = selectField("building_id", "Корпус", catalog.buildings, "building_id", "name", false);

  return [
    {
      key: "departments",
      title: "Кафедры",
      resource: "departments",
      idKey: "department_id",
      rows: catalog.departments,
      fields: [field("name", "Название")],
    },
    {
      key: "semesters",
      title: "Семестры",
      resource: "semesters",
      idKey: "semester_id",
      rows: catalog.semesters,
      fields: [
        field("name", "Название"),
        field("starts_on", "Дата начала", "date"),
        field("ends_on", "Дата окончания", "date"),
        field("is_active", "Активный", "checkbox", false, false),
      ],
    },
    {
      key: "teachers",
      title: "Преподаватели",
      resource: "teachers",
      idKey: "teacher_id",
      rows: catalog.teachers,
      fields: [
        field("full_name", "ФИО"),
        field("position", "Должность", "text", "", false),
        field("max_hours_per_week", "Макс. часов", "number", 18),
        departmentField,
        field("notes", "Примечание", "text", "", false),
      ],
    },
    {
      key: "groups",
      title: "Учебные группы",
      resource: "groups",
      idKey: "group_id",
      rows: catalog.groups,
      fields: [
        field("name", "Название"),
        field("course", "Курс", "number", 1),
        field("students_count", "Студентов", "number", 25),
        departmentField,
      ],
    },
    {
      key: "subjects",
      title: "Дисциплины",
      resource: "subjects",
      idKey: "subject_id",
      rows: catalog.subjects,
      fields: [field("name", "Название"), field("total_hours", "Часы", "number", 72), departmentField],
    },
    {
      key: "lessonTypes",
      title: "Типы занятий",
      resource: "lessonTypes",
      idKey: "lesson_type_id",
      rows: catalog.lessonTypes,
      fields: [field("name", "Название")],
    },
    {
      key: "buildings",
      title: "Корпуса",
      resource: "buildings",
      idKey: "building_id",
      rows: catalog.buildings,
      fields: [field("name", "Название"), field("address", "Адрес", "text", "", false)],
    },
    {
      key: "classrooms",
      title: "Аудитории",
      resource: "classrooms",
      idKey: "classroom_id",
      rows: catalog.classrooms,
      fields: [
        buildingField,
        field("name", "Номер"),
        field("capacity", "Вместимость", "number", 30),
        field("equipment", "Оборудование", "text", "", false),
      ],
    },
    {
      key: "timeSlots",
      title: "Временные слоты",
      resource: "timeSlotTemplates",
      idKey: "pair_number",
      rows: timeSlotTemplateRows(catalog.timeSlots),
      fields: [
        field("pair_number", "№", "number", 1),
        field("starts_at", "Начало", "time", "08:30"),
        field("ends_at", "Окончание", "time", "10:00"),
      ],
    },
    {
      key: "assignments",
      title: "Учебные поручения",
      resource: "assignments",
      idKey: "assignment_id",
      rows: catalog.assignments,
      fields: assignmentFields(catalog),
    },
  ];
}

function buildConstraintConfigs(catalog: Catalog): DictionaryConfig[] {
  const slotField = selectField("time_slot_id", "Временной слот", slotOptions(catalog.timeSlots), "time_slot_id", "label");
  const teacherField = selectField("teacher_id", "Преподаватель", catalog.teachers, "teacher_id", "full_name");
  const groupField = selectField("group_id", "Группа", catalog.groups, "group_id", "name");
  const classroomField = selectField("classroom_id", "Аудитория", catalog.classrooms, "classroom_id", "name");
  const reasonField = field("reason", "Причина", "text", "", false);
  const preferenceField = selectField(
    "preference",
    "Тип",
    [
      { value: "preferred", label: "Предпочтительно" },
      { value: "undesired", label: "Нежелательно" },
    ],
    "value",
    "label",
  );

  return [
    {
      key: "teacherUnavailability",
      title: "Недоступность преподавателей",
      resource: "teacherUnavailability",
      idKey: "unavailable_id",
      rows: catalog.teacherUnavailability,
      fields: [teacherField, slotField, reasonField],
    },
    {
      key: "groupUnavailability",
      title: "Недоступность групп",
      resource: "groupUnavailability",
      idKey: "unavailable_id",
      rows: catalog.groupUnavailability,
      fields: [groupField, slotField, reasonField],
    },
    {
      key: "classroomUnavailability",
      title: "Недоступность аудиторий",
      resource: "classroomUnavailability",
      idKey: "unavailable_id",
      rows: catalog.classroomUnavailability,
      fields: [classroomField, slotField, reasonField],
    },
    {
      key: "teacherPreferences",
      title: "Предпочтения преподавателей",
      resource: "teacherPreferences",
      idKey: "preference_id",
      rows: catalog.teacherPreferences,
      fields: [teacherField, slotField, preferenceField, field("weight", "Вес", "number", 1)],
    },
  ];
}

function ConstraintsSection({
  activeConstraint,
  catalog,
  disabled,
  onCreate,
  onImport,
  onUpdate,
  onDelete,
}: ResourceHandlers & { activeConstraint: ConstraintKey; catalog: Catalog; disabled: boolean }) {
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

function ScheduleSection({
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
}: {
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
}) {
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

function FieldInput({
  field,
  value,
  isDefault = false,
  onChange,
}: {
  field: FieldConfig;
  value: RowValue;
  isDefault?: boolean;
  onChange?: (value: RowValue) => void;
}) {
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

function field(
  name: string,
  label: string,
  type: FieldConfig["type"] = "text",
  defaultValue: RowValue = "",
  required = true,
): FieldConfig {
  return { name, label, type, defaultValue, required };
}

function selectField<T extends object>(
  name: string,
  label: string,
  options: T[],
  valueKey: keyof T,
  labelKey: keyof T,
  required = true,
): FieldConfig {
  return {
    name,
    label,
    type: "select",
    options: options as Record<string, unknown>[],
    valueKey: String(valueKey),
    labelKey: String(labelKey),
    defaultValue: String(options[0]?.[valueKey] ?? ""),
    required,
  };
}

function assignmentFields(catalog: Catalog): FieldConfig[] {
  return [
    selectField("semester_id", "Семестр", catalog.semesters, "semester_id", "name"),
    selectField("teacher_id", "Преподаватель", catalog.teachers, "teacher_id", "full_name"),
    selectField("subject_id", "Дисциплина", catalog.subjects, "subject_id", "name"),
    selectField("group_id", "Группа", catalog.groups, "group_id", "name"),
    selectField("lesson_type_id", "Тип занятия", catalog.lessonTypes, "lesson_type_id", "name"),
    field("hours_per_week", "Часов в неделю", "number", 2),
    field("classroom_capacity_required", "Мин. вместимость", "number", 20),
  ];
}

function emptyBody(fields: FieldConfig[]) {
  return Object.fromEntries(fields.map((item) => [item.name, item.defaultValue ?? (item.type === "checkbox" ? false : "")])) as RowData;
}

function createDraft(config: DictionaryConfig) {
  const draft = emptyBody(config.fields);
  if (config.key === "timeSlots") {
    const lastNumber = config.rows.reduce((max, row) => Math.max(max, Number(row.pair_number) || 0), 0);
    draft.pair_number = lastNumber + 1;
  }
  return draft;
}

async function readImportRows(file: File, config: DictionaryConfig) {
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

  if (fieldConfig.type === "select") {
    const option = fieldConfig.options?.find((item) => {
      const optionValue = String(item[fieldConfig.valueKey ?? "value"]).trim();
      const optionLabel = String(item[fieldConfig.labelKey ?? "label"]).trim();
      return optionValue === text || optionLabel.toLowerCase() === text.toLowerCase();
    });
    return option ? String(option[fieldConfig.valueKey ?? "value"]) : text;
  }

  if (fieldConfig.type === "checkbox") {
    return ["1", "true", "yes", "да", "истина", "активный"].includes(text.toLowerCase());
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

function hasImportValues(row: RowData) {
  return Object.values(row).some((value) => value !== "" && value !== null && value !== false);
}

function fieldsToBody(row: RowData, fields: FieldConfig[]) {
  return Object.fromEntries(fields.map((item) => [item.name, normalizeDraftValue(row[item.name], item)])) as RowData;
}

function rowTitle(row: RowData, fields: FieldConfig[]) {
  const preferred = fields.find((item) => ["name", "full_name", "subject_id", "group_id"].includes(item.name)) ?? fields[0];
  return formatValue(row[preferred.name], preferred);
}

function rowSubtitle(row: RowData, fields: FieldConfig[]) {
  return fields
    .filter((item) => item.name !== "name" && item.name !== "full_name")
    .slice(0, 3)
    .map((item) => formatValue(row[item.name], item))
    .filter((value) => value !== "—")
    .join(" · ");
}


function normalizeDraftValue(value: RowValue, item: FieldConfig): RowValue {
  if (value === null || value === undefined) return item.type === "checkbox" ? false : "";
  if (item.type === "date") return String(value).slice(0, 10);
  if (item.type === "time") return String(value).slice(0, 5);
  return value;
}

function normalizeInputValue(value: RowValue, type?: FieldConfig["type"]) {
  if (value === null || value === undefined) return "";
  if (type === "date") return String(value).slice(0, 10);
  if (type === "time") return String(value).slice(0, 5);
  return String(value);
}

function formatValue(value: RowValue, item: FieldConfig) {
  if (value === null || value === undefined || value === "") return "—";
  if (item.type === "select") {
    const option = item.options?.find((entry) => String(entry[item.valueKey ?? "value"]) === String(value));
    if (option) return String(option[item.labelKey ?? "label"]);
  }
  if (item.type === "checkbox") return value ? "Да" : "Нет";
  if (item.type === "date") return String(value).slice(0, 10);
  if (item.type === "time") return String(value).slice(0, 5);
  return String(value);
}

function timeSlotTemplateRows(slots: TimeSlot[]): TimeSlotTemplate[] {
  const rows = new Map<number, TimeSlotTemplate>();
  slots.forEach((slot) => {
    if (!rows.has(slot.pair_number)) {
      rows.set(slot.pair_number, {
        pair_number: slot.pair_number,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
      });
    }
  });
  return Array.from(rows.values()).sort((left, right) => left.pair_number - right.pair_number);
}

function slotOptions(slots: TimeSlot[]) {
  return slots.map((slot) => ({
    ...slot,
    label: `${dayNames[slot.day_of_week]} ${slot.pair_number} пара, ${trimTime(slot.starts_at)}-${trimTime(slot.ends_at)}`,
  }));
}

function trimTime(value: string) {
  return value?.slice(0, 5);
}

export default App;
