import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fmtDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

const SCOPES = [
  { key: 'global', label: 'Global' },
  { key: 'friends', label: 'Squad' },
];
const PERIODS = [
  { key: 'all', label: 'All time' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];
const METRICS = [
  { key: 'xp', label: 'XP' },
  { key: 'focus', label: 'Focus hours' },
  { key: 'wins', label: 'Battles won' },
  { key: 'streak', label: 'Streak' },
];

export default function Leaderboard() {
  const [scope, setScope] = useState('global');
  const [period, setPeriod] = useState('all');
  const [metric, setMetric] = useState('xp');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    base44.functions.invoke('getLeaderboard', { scope, period, metric })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [scope, period, metric]);

  const rows = data?.rows || [];
  const valueOf = (r) => {
    if (metric === 'focus') return fmtDuration(r.focus_seconds);
    if (metric === 'wins') return `${r.wins} W`;
    if (metric === 'streak') return `${r.streak} d`;
    return `${r.xp.toLocaleString()} XP`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Leaderboard</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Who actually <span className="text-[#B6FF3B]">shows up.</span></h1>
        </div>
        <button type="button" onClick={load} className="btn-ghost text-xs">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((s) => (
            <button key={s.key} type="button" onClick={() => setScope(s.key)} className={cn('rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition', scope === s.key ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/45 hover:border-white/25')}>
              {s.label}
            </button>
          ))}
          <span className="w-px self-stretch bg-white/10" />
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={cn('rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition', period === p.key ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/45 hover:border-white/25')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button key={m.key} type="button" onClick={() => setMetric(m.key)} className={cn('rounded-full border px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition', metric === m.key ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 text-white/35 hover:border-white/25')}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data?.my_rank && (
        <div className="panel flex items-center justify-between gap-3 border-[#B6FF3B]/25 bg-[#B6FF3B]/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#B6FF3B]">Your position</p>
          <p className="font-heading text-xl text-[#B6FF3B]">#{data.my_rank} <span className="font-body text-xs text-white/40">of {data.total_players}</span></p>
        </div>
      )}

      {loading ? (
        <div className="panel grid place-items-center py-20"><Loader2 className="animate-spin text-white/30" size={22} /></div>
      ) : rows.length === 0 ? (
        <div className="panel px-6 py-16 text-center">
          <Trophy className="mx-auto text-white/20" size={30} />
          <p className="mt-4 font-heading text-2xl">The board is empty</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/35">
            {scope === 'friends' ? 'Add squad members to compare focus.' : 'Nobody has logged a session yet. Be the first name here.'}
          </p>
          <Link to="/focus" className="btn-acid mx-auto mt-5 text-xs">Run a session</Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel hidden overflow-hidden md:block">
            <div className="grid grid-cols-[48px_1fr_90px_110px_90px_80px] gap-3 border-b border-white/10 px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-white/30">
              <span>Rank</span><span>Player</span><span>Level</span><span>{METRICS.find((m) => m.key === metric)?.label}</span><span>Focus</span><span>Win %</span>
            </div>
            {rows.map((r) => (
              <div key={r.user_id} className={cn('grid grid-cols-[48px_1fr_90px_110px_90px_80px] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0', r.is_me && 'bg-[#B6FF3B]/5')}>
                <span className={cn('font-heading text-lg', r.rank <= 3 ? 'text-[#B6FF3B]' : 'text-white/40')}>#{r.rank}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                    {r.avatar ? <img src={r.avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-white/40">{r.username?.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.username}{r.is_me && <span className="ml-1.5 font-mono text-[9px] text-[#B6FF3B]">YOU</span>}</p>
                    <p className="truncate font-mono text-[9px] uppercase tracking-widest text-white/25">{r.rank_title}</p>
                  </div>
                </div>
                <span className="font-mono text-xs text-white/50">LVL {r.level}</span>
                <span className="font-mono text-xs text-[#B6FF3B]">{valueOf(r)}</span>
                <span className="font-mono text-xs text-white/50">{fmtDuration(r.total_focus_seconds)}</span>
                <span className="font-mono text-xs text-white/50">{r.win_rate}%</span>
              </div>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <div key={r.user_id} className={cn('panel flex items-center gap-3 p-3', r.is_me && 'border-[#B6FF3B]/30 bg-[#B6FF3B]/5')}>
                <span className={cn('w-7 shrink-0 font-heading text-lg', r.rank <= 3 ? 'text-[#B6FF3B]' : 'text-white/35')}>#{r.rank}</span>
                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  {r.avatar ? <img src={r.avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-white/40">{r.username?.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.username}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">LVL {r.level} · {r.win_rate}% win</p>
                </div>
                <span className="font-mono text-xs text-[#B6FF3B]">{valueOf(r)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-center font-mono text-[9px] uppercase tracking-widest text-white/20">
        Rankings are computed from stored sessions and battle records — never hardcoded
      </p>
    </div>
  );
}