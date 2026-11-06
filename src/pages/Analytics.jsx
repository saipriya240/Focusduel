import { useEffect, useState } from 'react';
import { Activity, BarChart3, Clock, Loader2, Target, TrendingUp, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { CATEGORIES, categoryLabel, fmtDuration, lastNDays } from '@/lib/format';
import { cn } from '@/lib/utils';

const RANGES = [
  { key: 7, label: '7 days' },
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
];

export default function Analytics() {
  const { profile } = useProfile();
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const startKey = new Date(Date.now() - (range - 1) * 86400000).toISOString().slice(0, 10);
    const query = { date_key: { $gte: startKey } };

    Promise.all([
      base44.entities.FocusSession.aggregate({ query, groupBy: 'date_key', sum: ['focus_seconds'] }),
      base44.entities.FocusSession.aggregate({ query, groupBy: 'hour_key', sum: ['focus_seconds'] }),
      base44.entities.FocusSession.aggregate({ query, groupBy: 'category', sum: ['focus_seconds'] }),
      base44.entities.FocusSession.aggregate({ query, groupBy: 'completed', sum: ['focus_seconds'] }),
      base44.entities.FocusSession.filter(query, { sort: '-created_date', limit: 12 }),
    ]).then(([daily, hourly, cats, completed, recent]) => {
      if (!alive) return;
      setData({
        daily: daily.rows || [],
        hourly: hourly.rows || [],
        categories: cats.rows || [],
        completed: completed.rows || [],
        recent: recent.items || [],
      });
      setLoading(false);
    }).catch(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [range]);

  const timezone = profile?.timezone || 'Etc/UTC';
  const target = profile?.daily_target_minutes || 120;

  const dailyMap = {};
  (data?.daily || []).forEach((r) => { dailyMap[r.date_key] = r.sum_focus_seconds || 0; });
  const days = lastNDays(range, timezone).map((d) => ({ ...d, minutes: Math.round((dailyMap[d.key] || 0) / 60) }));

  const totalSeconds = days.reduce((s, d) => s + d.minutes * 60, 0);
  const sessionTotal = (data?.completed || []).reduce((s, r) => s + (r.count || 0), 0);
  const completedCount = (data?.completed || []).filter((r) => r.completed === true).reduce((s, r) => s + (r.count || 0), 0);
  const completionRate = sessionTotal ? Math.round((completedCount / sessionTotal) * 100) : 0;
  const goalDays = days.filter((d) => d.minutes >= target).length;
  const goalRate = range ? Math.round((goalDays / range) * 100) : 0;
  const bestDay = days.reduce((best, d) => (d.minutes > (best?.minutes || 0) ? d : best), null);
  const hourMap = {};
  (data?.hourly || []).forEach((r) => { hourMap[r.hour_key] = r.sum_focus_seconds || 0; });
  const bestHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
  const catMap = {};
  (data?.categories || []).forEach((r) => { catMap[r.category] = r.sum_focus_seconds || 0; });
  const maxDaily = Math.max(target, ...days.map((d) => d.minutes));

  const battleStats = profile ? { wins: profile.battles_won || 0, losses: profile.battles_lost || 0 } : { wins: 0, losses: 0 };
  const battleTotal = battleStats.wins + battleStats.losses;
  const winRate = battleTotal ? Math.round((battleStats.wins / battleTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Analytics</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Your <span className="text-[#B6FF3B]">receipts.</span></h1>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => setRange(r.key)}
              className={cn('rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition',
                range === r.key ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/45 hover:border-white/25')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="panel grid place-items-center py-24"><Loader2 className="animate-spin text-white/30" size={22} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: Clock, label: 'Total focus', value: fmtDuration(totalSeconds), sub: `${sessionTotal} sessions` },
              { icon: TrendingUp, label: 'Daily average', value: `${Math.round(totalSeconds / 60 / range)}m`, sub: `Target ${target}m` },
              { icon: Target, label: 'Completion rate', value: `${completionRate}%`, sub: `${completedCount} full sessions` },
              { icon: Trophy, label: 'Battle win rate', value: `${winRate}%`, sub: `${battleStats.wins}W · ${battleStats.losses}L` },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="panel p-4">
                <div className="flex items-center justify-between">
                  <p className="label-xs">{label}</p>
                  <Icon size={14} className="text-[#B6FF3B]/70" />
                </div>
                <p className="mt-2 font-heading text-3xl">{value}</p>
                <p className="mt-1 text-xs text-white/35">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="panel p-5 lg:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="label-xs">Daily focus</p>
                  <h2 className="mt-1 text-2xl">{range}-day trend</h2>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">Goal {target}m</span>
              </div>
              <div className="mt-5 flex h-40 items-end gap-[3px] sm:gap-1.5">
                {days.map((d, i) => (
                  <div key={d.key} className="group relative flex-1">
                    <div
                      className={cn('animate-rise w-full rounded-t transition-all', d.minutes >= target ? 'bg-[#B6FF3B]' : 'bg-white/20 group-hover:bg-white/35')}
                      style={{ height: `${Math.max(2, (d.minutes / maxDaily) * 150)}px`, animationDelay: `${Math.min(i * 12, 400)}ms` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-mono text-[9px] uppercase tracking-widest text-white/25">
                <span>{days[0]?.full}</span>
                <span>{days[days.length - 1]?.full}</span>
              </div>
            </section>

            <section className="panel p-5">
              <p className="label-xs">Patterns</p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/45">Best day</span>
                  <span className="font-semibold">{bestDay && bestDay.minutes > 0 ? `${bestDay.full} · ${bestDay.minutes}m` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45">Strongest hour</span>
                  <span className="font-semibold">{bestHour ? `${String(bestHour[0]).padStart(2, '0')}:00` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45">Goal days</span>
                  <span className="font-semibold">{goalDays}/{range} · {goalRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45">Current streak</span>
                  <span className="font-semibold text-[#B6FF3B]">{profile?.streak || 0} days</span>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel p-5">
              <p className="label-xs">Most productive hours</p>
              <div className="mt-4 grid grid-cols-12 gap-1">
                {Array.from({ length: 24 }).map((_, h) => {
                  const seconds = hourMap[h] || 0;
                  const max = Math.max(1, ...Object.values(hourMap));
                  const intensity = seconds / max;
                  return (
                    <div key={h} className="flex flex-col items-center gap-1">
                      <div
                        className="h-14 w-full rounded-sm border border-white/5"
                        style={{ background: intensity > 0 ? `rgba(182,255,59,${0.12 + intensity * 0.75})` : 'rgba(255,255,255,0.03)' }}
                        title={`${h}:00 — ${Math.round(seconds / 60)}m`}
                      />
                      {h % 4 === 0 && <span className="font-mono text-[8px] text-white/25">{h}</span>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel p-5">
              <p className="label-xs">Category split</p>
              <div className="mt-4 space-y-3">
                {CATEGORIES.map((c) => {
                  const seconds = catMap[c.value] || 0;
                  const pct = totalSeconds ? Math.round((seconds / totalSeconds) * 100) : 0;
                  return (
                    <div key={c.value}>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">{categoryLabel(c.value)}</span>
                        <span className="font-mono text-white/40">{fmtDuration(seconds)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#B6FF3B]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[#B6FF3B]" />
              <p className="label-xs">Recent sessions</p>
            </div>
            {data?.recent?.length ? (
              <div className="mt-3 divide-y divide-white/5">
                {data.recent.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{categoryLabel(s.category)}</p>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">
                        {s.date_key} · {s.planned_minutes}m planned{s.battle_id ? ' · duel' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn('font-mono text-xs', s.completed ? 'text-[#B6FF3B]' : 'text-white/45')}>
                        {fmtDuration(s.focus_seconds)}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">{s.completed ? 'complete' : 'partial'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <BarChart3 className="mx-auto text-white/20" size={24} />
                <p className="mt-3 text-sm text-white/35">No sessions in this range yet.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}