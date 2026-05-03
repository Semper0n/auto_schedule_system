CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

CREATE TABLE IF NOT EXISTS semesters (
    semester_id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_semesters_one_active
ON semesters (is_active)
WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS departments (
    department_id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS teachers (
    teacher_id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    full_name VARCHAR(160) NOT NULL,
    position VARCHAR(100),
    max_hours_per_week INTEGER NOT NULL DEFAULT 18,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS student_groups (
    group_id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    name VARCHAR(80) NOT NULL UNIQUE,
    course INTEGER NOT NULL DEFAULT 1,
    students_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subjects (
    subject_id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    name VARCHAR(180) NOT NULL,
    total_hours INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lesson_types (
    lesson_type_id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS buildings (
    building_id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    address VARCHAR(240)
);

CREATE TABLE IF NOT EXISTS classrooms (
    classroom_id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(building_id) ON DELETE SET NULL,
    name VARCHAR(80) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    equipment TEXT,
    UNIQUE (building_id, name)
);

CREATE TABLE IF NOT EXISTS time_slots (
    time_slot_id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
    pair_number INTEGER NOT NULL CHECK (pair_number BETWEEN 1 AND 8),
    starts_at TIME NOT NULL,
    ends_at TIME NOT NULL,
    UNIQUE (day_of_week, pair_number)
);

CREATE TABLE IF NOT EXISTS teaching_assignments (
    assignment_id SERIAL PRIMARY KEY,
    semester_id INTEGER NOT NULL REFERENCES semesters(semester_id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES student_groups(group_id) ON DELETE CASCADE,
    lesson_type_id INTEGER NOT NULL REFERENCES lesson_types(lesson_type_id) ON DELETE RESTRICT,
    hours_per_week INTEGER NOT NULL DEFAULT 2 CHECK (hours_per_week > 0),
    classroom_capacity_required INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teacher_unavailability (
    unavailable_id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id) ON DELETE CASCADE,
    reason TEXT,
    UNIQUE (teacher_id, time_slot_id)
);

CREATE TABLE IF NOT EXISTS group_unavailability (
    unavailable_id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES student_groups(group_id) ON DELETE CASCADE,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id) ON DELETE CASCADE,
    reason TEXT,
    UNIQUE (group_id, time_slot_id)
);

CREATE TABLE IF NOT EXISTS classroom_unavailability (
    unavailable_id SERIAL PRIMARY KEY,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(classroom_id) ON DELETE CASCADE,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id) ON DELETE CASCADE,
    reason TEXT,
    UNIQUE (classroom_id, time_slot_id)
);

CREATE TABLE IF NOT EXISTS teacher_preferences (
    preference_id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id) ON DELETE CASCADE,
    preference VARCHAR(20) NOT NULL CHECK (preference IN ('preferred', 'undesired')),
    weight INTEGER NOT NULL DEFAULT 1,
    UNIQUE (teacher_id, time_slot_id)
);

CREATE TABLE IF NOT EXISTS schedule_versions (
    version_id SERIAL PRIMARY KEY,
    semester_id INTEGER NOT NULL REFERENCES semesters(semester_id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    conflicts_count INTEGER NOT NULL DEFAULT 0,
    gaps_count INTEGER NOT NULL DEFAULT 0,
    preference_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_entries (
    entry_id SERIAL PRIMARY KEY,
    version_id INTEGER NOT NULL REFERENCES schedule_versions(version_id) ON DELETE CASCADE,
    assignment_id INTEGER NOT NULL REFERENCES teaching_assignments(assignment_id) ON DELETE CASCADE,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(time_slot_id) ON DELETE RESTRICT,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(classroom_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_schedule_entries_version ON schedule_entries(version_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_slot ON schedule_entries(time_slot_id);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    entity_name VARCHAR(120),
    entity_id INTEGER,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password_hash, role)
VALUES ('admin', crypt('admin', gen_salt('bf')), 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO semesters (name, starts_on, ends_on, is_active)
VALUES ('Весенний семестр 2026', '2026-02-01', '2026-06-30', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO departments (name)
VALUES ('Кафедра информационных систем'), ('Кафедра математики')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lesson_types (name)
VALUES ('Лекция'), ('Практика'), ('Лабораторная')
ON CONFLICT (name) DO NOTHING;

INSERT INTO buildings (name, address)
VALUES ('Главный корпус', 'ул. Учебная, 1')
ON CONFLICT (name) DO NOTHING;

INSERT INTO time_slots (day_of_week, pair_number, starts_at, ends_at)
VALUES
    (1, 1, '08:30', '10:00'), (1, 2, '10:10', '11:40'), (1, 3, '12:10', '13:40'), (1, 4, '13:50', '15:20'),
    (2, 1, '08:30', '10:00'), (2, 2, '10:10', '11:40'), (2, 3, '12:10', '13:40'), (2, 4, '13:50', '15:20'),
    (3, 1, '08:30', '10:00'), (3, 2, '10:10', '11:40'), (3, 3, '12:10', '13:40'), (3, 4, '13:50', '15:20'),
    (4, 1, '08:30', '10:00'), (4, 2, '10:10', '11:40'), (4, 3, '12:10', '13:40'), (4, 4, '13:50', '15:20'),
    (5, 1, '08:30', '10:00'), (5, 2, '10:10', '11:40'), (5, 3, '12:10', '13:40'), (5, 4, '13:50', '15:20'),
    (6, 1, '08:30', '10:00'), (6, 2, '10:10', '11:40')
ON CONFLICT (day_of_week, pair_number) DO NOTHING;

INSERT INTO classrooms (building_id, name, capacity, equipment)
SELECT b.building_id, room.name, room.capacity, room.equipment
FROM buildings b
CROSS JOIN (VALUES
    ('101', 30, 'Проектор'),
    ('205', 60, 'Проектор, компьютерный класс'),
    ('310', 25, 'Компьютерный класс')
) AS room(name, capacity, equipment)
WHERE b.name = 'Главный корпус'
ON CONFLICT (building_id, name) DO NOTHING;

INSERT INTO teachers (department_id, full_name, position, max_hours_per_week, notes)
SELECT d.department_id, teacher.full_name, teacher.position, teacher.max_hours_per_week, teacher.notes
FROM departments d
CROSS JOIN (VALUES
    ('Иванова Мария Петровна', 'доцент', 18, 'Предпочитает занятия до 15:20'),
    ('Петров Алексей Сергеевич', 'старший преподаватель', 20, 'Не работает в субботу'),
    ('Смирнова Елена Викторовна', 'профессор', 16, 'Лекции и консультации')
) AS teacher(full_name, position, max_hours_per_week, notes)
WHERE d.name = 'Кафедра информационных систем'
AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.full_name = teacher.full_name);

INSERT INTO student_groups (department_id, name, course, students_count)
SELECT d.department_id, grp.name, grp.course, grp.students_count
FROM departments d
CROSS JOIN (VALUES
    ('ИС-21', 2, 24),
    ('ИС-22', 2, 28),
    ('ПИ-31', 3, 22)
) AS grp(name, course, students_count)
WHERE d.name = 'Кафедра информационных систем'
ON CONFLICT (name) DO NOTHING;

INSERT INTO subjects (department_id, name, total_hours)
SELECT d.department_id, subject.name, subject.total_hours
FROM departments d
CROSS JOIN (VALUES
    ('Базы данных', 72),
    ('Проектирование информационных систем', 72),
    ('Алгоритмы оптимизации', 54)
) AS subject(name, total_hours)
WHERE d.name = 'Кафедра информационных систем'
AND NOT EXISTS (SELECT 1 FROM subjects s WHERE s.name = subject.name);

INSERT INTO teaching_assignments (
    semester_id,
    teacher_id,
    subject_id,
    group_id,
    lesson_type_id,
    hours_per_week,
    classroom_capacity_required
)
SELECT sem.semester_id, t.teacher_id, s.subject_id, g.group_id, lt.lesson_type_id, data.hours_per_week, g.students_count
FROM (VALUES
    ('Иванова Мария Петровна', 'Базы данных', 'ИС-21', 'Лекция', 2),
    ('Иванова Мария Петровна', 'Базы данных', 'ИС-22', 'Практика', 2),
    ('Петров Алексей Сергеевич', 'Проектирование информационных систем', 'ИС-21', 'Практика', 2),
    ('Петров Алексей Сергеевич', 'Проектирование информационных систем', 'ПИ-31', 'Лекция', 2),
    ('Смирнова Елена Викторовна', 'Алгоритмы оптимизации', 'ИС-22', 'Лекция', 2),
    ('Смирнова Елена Викторовна', 'Алгоритмы оптимизации', 'ПИ-31', 'Лабораторная', 2)
) AS data(teacher_name, subject_name, group_name, lesson_type_name, hours_per_week)
JOIN semesters sem ON sem.is_active = TRUE
JOIN teachers t ON t.full_name = data.teacher_name
JOIN subjects s ON s.name = data.subject_name
JOIN student_groups g ON g.name = data.group_name
JOIN lesson_types lt ON lt.name = data.lesson_type_name
WHERE NOT EXISTS (
    SELECT 1
    FROM teaching_assignments ta
    WHERE ta.semester_id = sem.semester_id
      AND ta.teacher_id = t.teacher_id
      AND ta.subject_id = s.subject_id
      AND ta.group_id = g.group_id
      AND ta.lesson_type_id = lt.lesson_type_id
);

INSERT INTO teacher_unavailability (teacher_id, time_slot_id, reason)
SELECT t.teacher_id, ts.time_slot_id, 'Недоступность преподавателя'
FROM teachers t
JOIN time_slots ts ON ts.day_of_week = 6
WHERE t.full_name = 'Петров Алексей Сергеевич'
ON CONFLICT (teacher_id, time_slot_id) DO NOTHING;

INSERT INTO teacher_preferences (teacher_id, time_slot_id, preference, weight)
SELECT t.teacher_id, ts.time_slot_id, 'preferred', 2
FROM teachers t
JOIN time_slots ts ON ts.day_of_week IN (1, 3) AND ts.pair_number IN (1, 2)
WHERE t.full_name = 'Иванова Мария Петровна'
ON CONFLICT (teacher_id, time_slot_id) DO NOTHING;
