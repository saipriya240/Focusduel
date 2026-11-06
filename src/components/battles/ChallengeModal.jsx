import { useState } from 'react';
import { Loader2, Swords, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { CATEGORIES } from '@/lib/format';
import { cn } from '@/lib/utils';

const DURATIONS = [15, 25, 45, 60];
const STAKES = [20, 40, 60, 100];

export default function ChallengeModal({ friends, defaultFriendId, onClose, onCreated }) {
  const [opponent, setOpponent] = useState(defaultFriendId || friends[0]?.friend_id || '');
  const [duration, setDuration] = useState(25);
  const [category, setCategory] = useState('deep_work');
  const [stake, setStake] = useState(40);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!opponent) {
      setError('Pick a rival first.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await base44.functions.invoke('battleAction', {
        action: 'create',
        opponent_id: opponent,
        duration_minutes: duration,
        category,
        xp_stake: stake,
      });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      onCreated(res.data.battle);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not send the challenge.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0C0D0F] p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-xs">New duel</p>
            <h2 className="mt-1 text-3xl">Challenge a friend</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <span className="label-xs">Rival</span>
            {friends.length === 0 ? (
              <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-white/40">
                Add friends first — duels only run between squad members.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {friends.map((f) => (
                  <button
                    key={f.friend_id}
                    type="button"
                    onClick={() => setOpponent(f.friend_id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      opponent === f.friend_id
                        ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]'
                        : 'border-white/10 text-white/55 hover:border-white/25'
                    )}
                  >
                    {f.friend_username}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="label-xs">Duration</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 font-mono text-xs transition',
                    duration === d ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/50 hover:border-white/25'
                  )}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label-xs">Focus category</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition',
                    category === c.value ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/50 hover:border-white/25'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label-xs">XP stake (winner takes it)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAKES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStake(s)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 font-mono text-xs transition',
                    stake === s ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/50 hover:border-white/25'
                  )}
                >
                  {s} XP
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

          <button type="button" onClick={send} disabled={sending || friends.length === 0} className="btn-acid w-full text-xs">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />} Send challenge
          </button>
        </div>
      </div>
    </div>
  );
}