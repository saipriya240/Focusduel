import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, RotateCcw, Square, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { CATEGORIES, categoryLabel } from '@/lib/format';
import { chime } from '@/lib/ambience';
import { cn } from '@/lib/utils';
import TimerDial from '@/components/focus/TimerDial';
import SoundPanel from '@/components/focus/SoundPanel';
import SessionResult from '@/components/focus/SessionResult';

const MODES = [
  { key: 'focus', label: 'Focus', minutes: 25 },
  { key: 'short', label: 'Short break', minutes: 5 },
  { key: 'long', label: 'Long break', minutes: 15 },
];

export default function FocusRoom() {
  const { profile, refresh } = useProfile();
  const [mode, setMode] = useState('focus');
  const [minutes, setMinutes] = useState(profile?.preferred_session_minutes || 25);
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(null);
  const [paused, setPaused] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [zen, setZen] = useState(false);
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0);
  const [category, setCategory] = useState(profile?.productivity_category || 'deep_work');
  const completeRef = useRef(null);

  useEffect(() => {
    if (profile?.preferred_session_minutes && mode === 'focus') {
      setMinutes(profile.preferred_session_minutes);
    }
    if (profile?.productivity_category) setCategory(profile.productivity_category);
  }, [profile?.preferred_session_minutes, profile?.productivity_category]);

  const resetClock = useCallback((nextMinutes) => {
    setRunning(false);
    setEndAt(null);
    setStartedAt(null);
    setPaused(0);
    setRemaining((nextMinutes || minutes) * 60);
  }, [minutes]);

  const complete = useCallback(async (finished) => {
    const planned = minutes;
    const plannedSeconds = planned * 60;
    const focusedSeconds = finished ? plannedSeconds : Math.max(0, plannedSeconds - remaining);

    setRunning(false);
    setEndAt(null);
    setZen(false);

    if (focusedSeconds < 60) {
      resetClock(planned);
      return;
    }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('finishSession', {
        planned_minutes: planned,
        focus_seconds: focusedSeconds,
        paused_count: paused,
        category,
        started_at: startedAt || new Date(Date.now() - focusedSeconds * 1000).toISOString(),
      });
      setResult({ ...res.data, focused_minutes: Math.round(focusedSeconds / 60), finished, planned });
      chime();
      if (finished && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Session complete', { body: `${planned} minutes locked in. ${res.data?.xp_awarded || 0} XP earned.` });
      }
      if (finished) setCompletedFocusSessions((c) => c + 1);
      await refresh();
    } finally {
      setSubmitting(false);
      setStartedAt(null);
      setPaused(0);
      resetClock(planned);
    }
  }, [minutes, remaining, paused, category, startedAt, refresh, resetClock]);

  completeRef.current = complete;

  useEffect(() => {
    if (!running || !endAt) return undefined;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        completeRef.current?.(true);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, endAt]);

  const start = () => {
    if (minutes * 60 - remaining < 1) setStartedAt(new Date().toISOString());
    setEndAt(Date.now() + remaining * 1000);
    setRunning(true);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const pause = () => {
    setRunning(false);
    setEndAt(null);
    setPaused((p) => p + 1);
  };

  const resume = () => {
    setEndAt(Date.now() + remaining * 1000);
    setRunning(true);
  };

  const pickMode = (m) => {
    if (running) return;
    setMode(m.key);
    const mins = m.minutes;
    setMinutes(mins);
    setRemaining(mins * 60);
    setStartedAt(null);
    setPaused(0);
  };

  const applyCustom = (value) => {
    const v = Math.min(120, Math.max(1, Number(value) || 25));
    setMinutes(v);
    if (!running) setRemaining(v * 60);
  };

  const toggleZen = async () => {
    const next = !zen;
    setZen(next);
    try {
      if (next && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      if (!next && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* fullscreen is a nice-to-have */
    }
  };

  const breakSuggestion = completedFocusSessions > 0 && completedFocusSessions % 4 === 0 ? 'long' : 'short';

  const controls = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {!running ? (
        <button type="button" onClick={remaining === minutes * 60 ? start : resume} disabled={submitting} className="btn-acid px-6">
          <Play size={16} /> {remaining === minutes * 60 ? 'Start' : 'Resume'}
        </button>
      ) : (
        <button type="button" onClick={pause} className="btn-ghost px-6">
          <Pause size={16} /> Pause
        </button>
      )}
      <button
        type="button"
        onClick={() => complete(false)}
        disabled={submitting || remaining === minutes * 60}
        className="btn-ghost px-4"
      >
        <Square size={14} /> End
      </button>
      <button type="button" onClick={() => resetClock(minutes)} disabled={submitting} className="btn-ghost px-4">
        <RotateCcw size={14} /> Reset
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Focus room</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Lock in. <span className="text-[#B6FF3B]">No exits.</span></h1>
        </div>
        <button type="button" onClick={toggleZen} className="btn-ghost text-xs">
          {zen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {zen ? 'Exit focus mode' : 'Full-screen focus'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel relative overflow-hidden p-6">
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-25" />
          <div className="relative">
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => pickMode(m)}
                  disabled={running}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition disabled:opacity-40',
                    mode === m.key
                      ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]'
                      : 'border-white/10 text-white/45 hover:border-white/25 hover:text-white'
                  )}
                >
                  {m.label} · {m.minutes}m
                </button>
              ))}
            </div>

            <div className="mt-7">
              <TimerDial remaining={remaining} total={minutes * 60} mode={MODES.find((m) => m.key === mode)?.label} running={running} />
            </div>

            <div className="mt-7">{controls}</div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label-xs">Custom duration (min)</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={minutes}
                  disabled={running}
                  onChange={(e) => applyCustom(e.target.value)}
                  className="field mt-1.5"
                />
              </label>
              <label className="block">
                <span className="label-xs">Focus category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1.5" disabled={running}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value} className="bg-[#0E0F11]">{c.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {paused > 0 && (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-red-400/80">
                {paused} pause{paused > 1 ? 's' : ''} recorded — pauses are saved with your session.
              </p>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <SoundPanel />
          <div className="panel p-4">
            <p className="label-xs">Session plan</p>
            <div className="mt-3 space-y-2 text-sm text-white/55">
              <p className="flex justify-between"><span>Category</span><span className="text-white">{categoryLabel(category)}</span></p>
              <p className="flex justify-between"><span>Planned</span><span className="text-white">{minutes} min</span></p>
              <p className="flex justify-between"><span>XP on completion</span><span className="text-[#B6FF3B]">+{Math.round(minutes)}</span></p>
            </div>
            {completedFocusSessions > 0 && !running && (
              <button
                type="button"
                onClick={() => pickMode(MODES.find((m) => m.key === breakSuggestion))}
                className="mt-4 w-full rounded-xl border border-[#B6FF3B]/30 bg-[#B6FF3B]/5 px-3 py-2.5 text-left text-xs text-[#B6FF3B] transition hover:bg-[#B6FF3B]/10"
              >
                Take a {breakSuggestion === 'long' ? '15-min long' : '5-min short'} break →
              </button>
            )}
          </div>
        </div>
      </div>

      {submitting && (
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-white/40">Saving session…</p>
      )}

      {zen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050506] px-6">
          <div className="scan-lines pointer-events-none absolute inset-0 opacity-20" />
          <TimerDial remaining={remaining} total={minutes * 60} mode={MODES.find((m) => m.key === mode)?.label} running={running} />
          <div className="mt-10">{controls}</div>
          <button type="button" onClick={toggleZen} className="mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-white/35 hover:text-white">
            Exit focus mode
          </button>
        </div>
      )}

      {result && (
        <SessionResult
          result={result}
          onClose={() => setResult(null)}
          onBreak={() => {
            setResult(null);
            pickMode(MODES.find((m) => m.key === breakSuggestion));
          }}
        />
      )}

      <p className="flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/20">
        <Zap size={10} /> Session time is verified server-side before any XP is awarded
      </p>
    </div>
  );
}