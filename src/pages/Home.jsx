import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Flame, Loader2, Swords, Target, Timer, Trophy, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import StatTile from '@/components/dashboard/StatTile';
import WeeklyBars from '@/components/dashboard/WeeklyBars';
import { dateKeyInTZ, lastNDays, levelInfo, fmtDuration } from '@/lib/format';

const QUICK_LINKS = [
  { to: '/focus', icon: Timer, title: 'Focus Room', desc: 'Run a session, drown out the noise.' },
  { to: '/battles', icon: Swords, title: 'Live Battles', desc: '1v1 duels on a shared clock.' },
  { to: '/leaderboard', icon: Trophy, title: 'Leaderboard', desc: 'See who actually shows up.' },
];

export default function Home() {
  const { profile } = useProfile();
  const [state, setState] = useState({ week: [], achievements: [], battles: [], rank: null, loading: true });

  useEffect(() => {
    if (!profile?.id) return undefined;
    let alive = true;
    const tz = profile.timezone || 'Etc/UTC';
    const days = lastNDays(7, tz);
    const startKey = days[0].key;

    Promise.all([
      base44.entities.FocusSession.aggregate({ query: { date_key: { $gte: startKey } }, groupBy: 'date_key', sum: ['focus_seconds'] }),
      base44.entities.UserAchievement.filter({}, { sort: '-unlocked_at', limit: 3 }),
      base44.entities.Battle.filter({}, { sort: '-created_date', limit: 20 }),
      base44.functions.invoke('getLeaderboard', { scope: 'global', period: 'all', metric: 'xp' }),
    ]).then(([daily, ach, battleRes, board]) => {
      if (!alive) return;
      const map = {};
      (daily.rows || []).forEach((r) => { map[r.date_key] = r.sum_focus_seconds || 0; });
      setState({
        week: days.map((d) => ({ day: d.label, key: d.key, minutes: Math.round((map[d.key] || 0) / 60) })),
        achievements: ach.items || [],
        battles: (battleRes.items || []).filter((b) => ['active', 'pending'].includes(b.status)).slice(0, 3),
        rank: board.data?.my_rank || null,
        loading: false,
      });
    }).catch(() => alive && setState((s) => ({ ...s, loading: false })));

    return () => { alive = false; };
  }, [profile?.id, profile?.timezone]);

  if (!profile) return null;

  const tz = profile.timezone || 'Etc/UTC';
  const todayKey = dateKeyInTZ(new Date(), tz);
  const todayMinutes = state.week.find((d) => d.key === todayKey)?.minutes || 0;
  const target = profile.daily_target_minutes || 120;
  const goalPct = Math.min(100, Math.round((todayMinutes / target) * 100));
  const lvl = levelInfo(profile.xp || 0);
  const battlesPlayed = (profile.battles_won || 0) + (profile.battles_lost || 0);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C0D0F] p-6 sm:p-9">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#B6FF3B]/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B6FF3B]/30 bg-[#B6FF3B]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#B6FF3B]">
              <Flame size={11} /> {profile.streak || 0} day streak
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Your biggest competition is your distracted self
            </span>
          </div>

          <h1 className="mt-5 text-[2.6rem] leading-[0.9] sm:text-6xl lg:text-7xl">
            Ready to lock in,<br />
            <span className="text-[#B6FF3B]">{profile.display_name || profile.username}?</span>
          </h1>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link to="/focus" className="btn-acid text-sm">
              <Zap size={16} /> Start a focus session
            </Link>
            <Link to="/battles" className="btn-ghost text-sm">
              <Swords size={16} /> Challenge a friend
            </Link>
          </div>

          <div className="mt-8 max-w-sm">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-white/35">
              <span>Level {profile.level || 1} · {profile.rank_title || 'Contender'}</span>
              <span>{profile.xp || 0} XP</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#B6FF3B] transition-all duration-700" style={{ width: `${lvl.pct}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Focus today" value={todayMinutes} unit="min" sub={`Goal ${target} min`} tone="acid" />
        <StatTile label="Goal" value={`${goalPct}%`} sub="of daily target" />
        <StatTile label="Streak" value={profile.streak || 0} unit="days" sub={`Best ${profile.longest_streak || 0}`} />
        <StatTile label="XP" value={(profile.xp || 0).toLocaleString()} sub={`Level ${profile.level || 1}`} />
        <StatTile label="Rank" value={state.rank ? `#${state.rank}` : '—'} sub="Global" />
        <StatTile label="Battles" value={`${profile.battles_won || 0}W`} sub={`${profile.battles_lost || 0} losses · ${battlesPlayed} played`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="panel p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="label-xs">This week</p>
              <h2 className="mt-1 text-2xl">Focus output</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">
              Total {fmtDuration(state.week.reduce((s, d) => s + d.minutes * 60, 0))}
            </span>
          </div>
          <div className="mt-6">
            {state.loading ? (
              <div className="grid h-44 place-items-center"><Loader2 className="animate-spin text-white/25" size={20} /></div>
            ) : (
              <WeeklyBars data={state.week} goal={target} />
            )}
          </div>
        </motion.section>

        <div className="space-y-4">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="label-xs">Recent achievements</p>
              <Link to="/settings" className="font-mono text-[9px] uppercase tracking-widest text-white/30 hover:text-white">All</Link>
            </div>
            {state.achievements.length === 0 ? (
              <p className="mt-3 text-xs text-white/35">No badges yet. Finish a session to start earning.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {state.achievements.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#B6FF3B]/25 bg-[#B6FF3B]/10">
                      <Target size={16} className="text-[#B6FF3B]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.name}</p>
                      <p className="truncate text-xs text-white/35">{a.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <p className="label-xs">Open battles</p>
            {state.battles.length === 0 ? (
              <div className="mt-3">
                <p className="text-xs text-white/35">No duels running or waiting on you.</p>
                <Link to="/battles" className="btn-ghost mt-3 w-full text-[10px]">Start a duel</Link>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.battles.map((b) => (
                  <li key={b.id}>
                    <Link to={`/battles/${b.id}`} className="block rounded-xl border border-white/10 bg-black/30 p-3 transition hover:border-white/25">
                      <p className="text-sm font-semibold">{b.duration_minutes} min · {b.xp_stake} XP</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-white/30">{b.status === 'active' ? 'Live now' : 'Waiting for a response'}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to} className="panel panel-hover group flex items-center gap-4 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
              <Icon size={18} className="text-[#B6FF3B]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="truncate text-xs text-white/35">{desc}</p>
            </div>
            <ArrowUpRight size={16} className="text-white/25 transition group-hover:text-[#B6FF3B]" />
          </Link>
        ))}
      </section>
    </div>
  );
}