const { pool } = require("../db");

async function getScheduleEntries(versionId, userId) {
  const result = await pool.query(
    `
      SELECT se.entry_id, se.version_id, se.assignment_id, se.time_slot_id, se.classroom_id,
             ts.day_of_week, ts.pair_number, ts.starts_at, ts.ends_at,
             t.teacher_id, t.full_name AS teacher_name,
             ta.group_id,
             COALESCE(array_agg(g.group_id ORDER BY g.name) FILTER (WHERE g.group_id IS NOT NULL), ARRAY[ta.group_id]) AS group_ids,
             COALESCE(string_agg(g.name, ', ' ORDER BY g.name), fallback_group.name) AS group_name,
             COALESCE(SUM(g.students_count), fallback_group.students_count, 0)::int AS students_count,
             s.name AS subject_name, lt.name AS lesson_type_name,
             c.name AS classroom_name, c.capacity,
             b.name AS building_name
      FROM schedule_entries se
      JOIN time_slots ts ON ts.time_slot_id = se.time_slot_id
      JOIN classrooms c ON c.classroom_id = se.classroom_id
      LEFT JOIN buildings b ON b.building_id = c.building_id
      JOIN teaching_assignments ta ON ta.assignment_id = se.assignment_id
      JOIN teachers t ON t.teacher_id = ta.teacher_id
      LEFT JOIN teaching_assignment_groups tag ON tag.assignment_id = ta.assignment_id
      LEFT JOIN student_groups g ON g.group_id = tag.group_id
      LEFT JOIN student_groups fallback_group ON fallback_group.group_id = ta.group_id
      JOIN subjects s ON s.subject_id = ta.subject_id
      JOIN lesson_types lt ON lt.lesson_type_id = ta.lesson_type_id
      WHERE se.version_id = $1 AND ta.user_id = $2
      GROUP BY se.entry_id, ts.time_slot_id, t.teacher_id, ta.assignment_id, fallback_group.name, fallback_group.students_count,
               s.name, lt.name, c.classroom_id, b.name
      ORDER BY ts.day_of_week, ts.pair_number, group_name
    `,
    [versionId, userId],
  );
  return result.rows;
}

function calculateMetrics(entries, preferences = []) {
  const conflicts = [];
  const used = {
    teachers: new Map(),
    groups: new Map(),
    classrooms: new Map(),
  };

  for (const entry of entries) {
    for (const [type, id] of [
      ["teachers", entry.teacher_id],
      ["classrooms", entry.classroom_id],
    ]) {
      const key = `${id}:${entry.time_slot_id}`;
      if (used[type].has(key)) {
        conflicts.push({
          type,
          time_slot_id: entry.time_slot_id,
          entries: [used[type].get(key), entry.entry_id],
        });
      }
      used[type].set(key, entry.entry_id);
    }
    const groupIds = entry.group_ids?.length ? entry.group_ids : [entry.group_id];
    for (const groupId of groupIds) {
      const key = `${groupId}:${entry.time_slot_id}`;
      if (used.groups.has(key)) {
        conflicts.push({
          type: "groups",
          time_slot_id: entry.time_slot_id,
          entries: [used.groups.get(key), entry.entry_id],
        });
      }
      used.groups.set(key, entry.entry_id);
    }

    if (entry.capacity < entry.students_count) {
      conflicts.push({
        type: "capacity",
        entry_id: entry.entry_id,
        message: "Вместимость аудитории меньше численности группы",
      });
    }
  }

  const gapsByResource = new Map();
  for (const entry of entries) {
    const gapResources = [["teacher", entry.teacher_id], ...(entry.group_ids?.length ? entry.group_ids : [entry.group_id]).map((groupId) => ["group", groupId])];
    for (const [prefix, id] of gapResources) {
      const key = `${prefix}:${id}:${entry.day_of_week}`;
      if (!gapsByResource.has(key)) gapsByResource.set(key, []);
      gapsByResource.get(key).push(entry.pair_number);
    }
  }

  let gaps = 0;
  for (const pairNumbers of gapsByResource.values()) {
    const unique = [...new Set(pairNumbers)].sort((a, b) => a - b);
    for (let index = 1; index < unique.length; index += 1) {
      gaps += Math.max(0, unique[index] - unique[index - 1] - 1);
    }
  }

  const preferenceMap = new Map(
    preferences.map((item) => [`${item.teacher_id}:${item.time_slot_id}`, item]),
  );
  const preferenceScore = entries.reduce((score, entry) => {
    const preference = preferenceMap.get(`${entry.teacher_id}:${entry.time_slot_id}`);
    if (!preference) return score;
    return score + (preference.preference === "preferred" ? preference.weight : -preference.weight);
  }, 0);

  return {
    conflicts_count: conflicts.length,
    gaps_count: gaps,
    preference_score: preferenceScore,
    conflicts,
  };
}

module.exports = { calculateMetrics, getScheduleEntries };
