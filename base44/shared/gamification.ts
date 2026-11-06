// Shared gamification rules used by every backend function so scoring can never
// be computed differently in two places.

export const XP = {
  perFocusMinute: 1,
  partialRate: 0.5,
  dailyGoalBonus: 50,
  streakBonus: 100,
  defaultBattleStake: 40,
};

export const ACHIEVEMENTS = {
  first_blood: { name: 'First Blood', description: 'Win your first battle' },
  locked_in: { name: 'Locked In', description: 'Reach 5 hours of total focus' },
  no_distractions: { name: 'No Distractions', description: 'Complete 5 focus sessions' },
  unstoppable: { name: 'Unstoppable', description: 'Hold a 7-day streak' },
  focus_legend: { name: 'Focus Legend', description: 'Win 10 battles' },
  deep_diver: { name: 'Deep Diver', description: 'Finish a 60-minute session' },
};

export const RANK_TITLES = [
  { min: 1, title: 'Rookie' },
  { min: 3, title: 'Contender' },
  { min: 5, title: 'Grinder' },
  { min: 8, title: 'Operator' },
  { min: 12, title: 'Locked In' },
  { min: 16, title: 'Machine' },
  { min: 22, title: 'Focus Legend' },
];

export function levelFromXp(xp) {
  let level = 1;
  let need = 200;
  let acc = 0;
  while (xp >= acc + need && level < 99) {
    acc += need;
    level += 1;
    need += 100;
  }
  return { level, levelFloor: acc, nextLevelAt: acc + need, progress: xp - acc, span: need };
}

export function rankTitle(level) {
  let title = RANK_TITLES[0].title;
  for (const r of RANK_TITLES) if (level >= r.min) title = r.title;
  return title;
}

// YYYY-MM-DD in a given IANA timezone.
export function dateKey(date = new Date(), timeZone = 'UTC') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function localHour(date = new Date(), timeZone = 'UTC') {
  try {
    const h = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(date);
    return parseInt(h, 10);
  } catch {
    return date.getUTCHours();
  }
}

export function daysBetween(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00Z`).getTime();
  const b = new Date(`${bKey}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function sanitizeHandle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}