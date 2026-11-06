import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pause, Play, RotateCcw, Swords, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { categoryLabel, fmtClock, fmtDuration } from '@/lib/format';
import { chime } from '@/lib/ambience';
import { cn } from '@/lib/utils';

export default function BattleRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [focusing, setFocusing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const focusingRef = useRef(false);
  const finishedRef = useRef(false);

  const load = useCallback(async () => {
    const res = await base44.entities.Battle.filter({ id }, { limit: 1 });
    const found = (res.items || [])[0];
    setBattle(found || null);
    setLoading(false);
    return found;
  }, [id]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const unsubscribe = base44.entities.Battle.subscribe((event) => {
      const changed = event?.data;
      if (!changed?.id || changed.id === id) load();
    });
    return unsubscribe;
  }, [id, load]);

  // Local countdown derived from the server-issued end timestamp.
  useEffect(() => {
    if (!battle?.ends_at) return undefined;
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(battle.ends_at).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [battle?.ends_at]);

  const ping = useCallback(async (focused, paused = false) => {
    if (!battle || battle.status !== 'active') return;
    try {
      const res = await base44.functions.invoke('battleAction', {
        action: 'ping',
        battle_id: battle.id,
        focused,
        paused,
      });
      if (res.data?.battle) setBattle(res.data.battle);
    } catch {
      /* transient — the next ping retries */
    }
  }, [battle]);

  // Heartbeat: the server credits elapsed time only while we keep signalling focus.
  useEffect(() => {
    if (battle?.status !== 'active') return undefined;
    ping(focusingRef.current);
    const timer = setInterval(() => ping(focusingRef.current), 10000);
    return () => clearInterval(timer);
  }, [battle?.status, battle?.id, ping]);

  const settle = useCallback(async () => {
    if (!battle || battle.status !== 'active' || finishedRef.current) return;
    finishedRef.current = true;
    try {
      const res = await base44.functions.invoke('battleAction', { action: 'finish', battle_id: battle.id });
      if (res.data?.battle) setBattle(res.data.battle);
      chime();
    } catch {
      finishedRef.current = false;
    }
  }, [battle]);

  useEffect(() => {
    if (battle?.status === 'active' && remaining <= 0) settle();
  }, [remaining, battle?.status, settle]);

  const toggleFocus = () => {
    const next = !focusing;
    setFocusing(next);
    focusingRef.current = next;
    ping(next, !next);
  };

  const act = async (action) => {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('battleAction', { action, battle_id: id });
      if (res.data?.error) setError(res.data.error);
      else if (res.data?.battle) setBattle(res.data.battle);
    } catch (e) {
      setError(e?.response?.data?.error || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const rematch = async () => {
    if (!battle) return;
    setBusy(true);
    try {
      const opponentId = battle.challenger_id === user?.id ? battle.opponent_id : battle.challenger_id;
      await base44.functions.invoke('battleAction', {
        action: 'create',
        opponent_id: opponentId,
        duration_minutes: battle.duration_minutes,
        category: battle.category,
        xp_stake: battle.xp_stake,
        rematch_of: battle.id,
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="panel grid place-items-center py-24">
        <Loader2 className="animate-spin text-white/30" size={22} />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="panel px-6 py-20 text-center">
        <p className="font-heading text-3xl">Battle not found</p>
        <p className="mt-2 text-sm text-white/40">It may have been cancelled or belongs to another squad.</p>
        <Link to="/battles" className="btn-ghost mx-auto mt-5 text-xs">Back to duels</Link>
      </div>
    );
  }

  const isChallenger = battle.challenger_id === user?.id;
  const isOpponent = battle.opponent_id === user?.id;
  const me = isChallenger
    ? { name: battle.challenger_username, avatar: battle.challenger_avatar, score: battle.challenger_focus_seconds || 0, paused: battle.challenger_paused || 0 }
    : { name: battle.opponent_username, avatar: battle.opponent_avatar, score: battle.opponent_focus_seconds || 0, paused: battle.opponent_paused || 0 };
  const rival = isChallenger
    ? { name: battle.opponent_username, avatar: battle.opponent_avatar, score: battle.opponent_focus_seconds || 0, paused: battle.opponent_paused || 0 }
    : { name: battle.challenger_username, avatar: battle.challenger_avatar, score: battle.challenger_focus_seconds || 0, paused: battle.challenger_paused || 0 };

  const total = battle.duration_minutes * 60;
  const pct = (s) => Math.min(100, Math.round((s / total) * 100));
  const finished = battle.status === 'completed';
  const won = battle.winner_id === user?.id;

  const PlayerCard = ({ player, side, highlight }) => (
    <div className={cn('panel relative overflow-hidden p-5', highlight && 'border-[#B6FF3B]/30')}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          {player.avatar
            ? <img src={player.avatar} alt="" className="h-full w-full object-cover" />
            : <span className="font-heading text-lg text-white/40">{player.name?.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{player.name}</p>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">{side}</p>
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="font-heading text-3xl tabular-nums">{fmtDuration(player.score)}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">{pct(player.score)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#B6FF3B] transition-all duration-700" style={{ width: `${pct(player.score)}%` }} />
      </div>
      {player.paused > 0 && (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-red-400/70">{player.paused} pause{player.paused > 1 ? 's' : ''} logged</p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/battles" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white">
          <ArrowLeft size={13} /> All duels
        </Link>
        <span className={cn(
          'rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-widest',
          battle.status === 'active' ? 'border-[#B6FF3B]/40 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/15 bg-white/5 text-white/50'
        )}>
          {battle.status}
        </span>
      </div>

      <div className="panel relative overflow-hidden p-6 text-center">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative">
          <p className="label-xs">{battle.duration_minutes} min · {categoryLabel(battle.category)} · {battle.xp_stake} XP stake</p>
          <p className="mt-3 font-heading text-6xl tabular-nums sm:text-7xl">
            {battle.status === 'active' ? fmtClock(remaining) : battle.status === 'pending' ? '--:--' : 'DONE'}
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-white/30">
            {battle.status === 'active' ? 'Server-synced clock' : battle.status === 'pending' ? 'Waiting for both players' : `Settled ${battle.settled_at ? new Date(battle.settled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}`}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerCard player={me} side="You" highlight={battle.status === 'active' && focusing} />
        <PlayerCard player={rival} side="Rival" />
      </div>

      {finished && (
        <div className={cn(
          'panel flex flex-col items-center gap-3 p-6 text-center',
          won ? 'border-[#B6FF3B]/40 bg-[#B6FF3B]/5' : battle.is_draw ? 'border-white/15' : 'border-red-500/30 bg-red-500/5'
        )}>
          <Trophy size={26} className={won ? 'text-[#B6FF3B]' : 'text-white/40'} />
          <p className="font-heading text-3xl">{battle.is_draw ? 'Draw' : won ? 'Victory' : 'Defeat'}</p>
          <p className="max-w-sm text-sm text-white/45">
            {battle.is_draw
              ? 'Identical focus time. Nobody blinked.'
              : won
                ? `You out-focused ${rival.name}. ${battle.xp_stake} XP is yours.`
                : `${rival.name} held on longer this time.`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={rematch} disabled={busy} className="btn-acid text-xs">
              <RotateCcw size={14} /> Rematch
            </button>
            <Link to="/battles" className="btn-ghost text-xs">All duels</Link>
          </div>
        </div>
      )}

      {battle.status === 'active' && (
        <div className="panel p-5 text-center">
          <button
            type="button"
            onClick={toggleFocus}
            className={cn('text-sm', focusing ? 'btn-ghost w-full' : 'btn-acid w-full')}
          >
            {focusing ? <Pause size={16} /> : <Play size={16} />}
            {focusing ? 'Pause — your clock stops counting' : 'Lock in — start banking focus time'}
          </button>
          <p className="mt-3 font-mono text-[9px] uppercase leading-relaxed tracking-widest text-white/25">
            Focus credit is verified by the server every 10 seconds. Closing the tab stops your clock — it never awards the win.
          </p>
        </div>
      )}

      {battle.status === 'pending' && (
        <div className="panel p-5 text-center">
          {isOpponent ? (
            <>
              <p className="text-sm text-white/60">{battle.challenger_username} wants to duel. Accepting starts the clock immediately.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={() => act('accept')} disabled={busy} className="btn-acid text-xs">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />} Accept duel
                </button>
                <button type="button" onClick={() => act('decline')} disabled={busy} className="btn-ghost text-xs">Decline</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-white/60">Challenge sent to {rival.name}. Stay on this screen — the arena opens the moment they accept.</p>
              <button type="button" onClick={() => act('cancel')} disabled={busy} className="btn-ghost mx-auto mt-4 text-xs">Withdraw challenge</button>
            </>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">{error}</p>}

      <p className="text-center font-mono text-[9px] uppercase tracking-widest text-white/20">
        Reconnect any time — the battle keeps running on server time
      </p>
    </div>
  );
}