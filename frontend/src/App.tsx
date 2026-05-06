import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { API_URL, constraintMenu, dictionaryMenu, emptyCatalog, sections } from "./constants";
import { ConstraintsSection } from "./sections/ConstraintsSection";
import { Dashboard } from "./sections/Dashboard";
import { DataSection } from "./sections/DataSection";
import { ScheduleSection } from "./sections/ScheduleSection";
import type {
  AuthUser,
  Catalog,
  ConstraintKey,
  Department,
  DictionaryKey,
  Id,
  RowData,
  ScheduleEntry,
  Section,
  Version,
} from "./types";

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

  async function deleteResource(resource: string, ids: number[]) {
    const deleteLabel = ids.length > 1 ? `выбранные записи (${ids.length})` : "запись";
    const confirmed = window.confirm(`Удалить ${deleteLabel}? Если они используются в расписании или поручениях, система не позволит удалить их.`);
    if (!confirmed) return;

    setIsBusy(true);
    try {
      for (const id of ids) {
        await request(`/${resource}/${id}`, { method: "DELETE" });
      }
      await loadAll();
      setMessage(ids.length > 1 ? `Удалено записей: ${ids.length}` : "Запись удалена");
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

export default App;
