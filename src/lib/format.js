export const CATEGORIES = [
  { value: 'deep_work', label: 'Deep Work' },
  { value: 'study', label: 'Study' },
  { value: 'building', label: 'Building' },
  { value: 'creative', label: 'Creative' },
  { value: 'admin', label: 'Admin' },
];

export const PERSONALITIES = [
  { value: 'night_owl', label: 'The Night Owl', desc: 'Peak output when the world sleeps.', time: '22:00 — 02:00' },
  { value: 'early_bird', label: 'The Early Bird', desc: 'Win the day before it starts.', time: '05:00 — 09:00' },
  { value: 'silent_assassin', label: 'The Silent Assassin', desc: 'No noise. No witnesses. Just results.', time: 'Anywhere, quietly' },
  { value: 'comeback_king', label: 'The Comeback King', desc: 'Lose a week, win the month.', time: 'Whenever it counts' },
];

export const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label || 'Deep Work';

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function levelInfo(xp = 0) {
  let level = 1;
  let need = 200;
  let acc = 0;
  while (xp >= acc + need && level < 99) {
    acc += need;
    level += 1;
    need += 100;
  }
  return { level, floor: acc, next: acc + need, progress: xp - acc, span: need, pct: Math.min(100, Math.round(((xp - acc) / need) * 100)) };
}

export function dateKeyInTZ(date = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function lastNDays(n, timeZone) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    out.push({
      key: dateKeyInTZ(d, timeZone),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
      full: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
    });
  }
  return out;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function initials(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}