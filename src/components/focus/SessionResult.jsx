import { motion } from 'framer-motion';
import { Check, Flame, Sparkles, X, Zap } from 'lucide-react';

export default function SessionResult({ result, onClose, onBreak }) {
  const unlocked = result.achievements || [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="w-full max-w-md rounded-3xl border border-[#B6FF3B]/25 bg-[#0C0D0F] p-6 shadow-[0_0_80px_-20px_rgba(182,255,59,0.4)]"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="label-xs">{result.finished ? 'Session complete' : 'Session ended early'}</p>
            <h2 className="mt-1 text-3xl">{result.finished ? 'Locked in.' : 'Better than nothing.'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="label-xs">Focus</p>
            <p className="mt-1 font-heading text-xl">{result.focused_minutes}m</p>
          </div>
          <div className="rounded-xl border border-[#B6FF3B]/25 bg-[#B6FF3B]/10 p-3 text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#B6FF3B]/70">XP</p>
            <p className="mt-1 font-heading text-xl text-[#B6FF3B]">+{result.xp_awarded}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="label-xs">Streak</p>
            <p className="mt-1 font-heading text-xl">{result.streak}</p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-white/45">
          <p className="flex justify-between"><span>Focus minutes</span><span className="text-white">+{result.minutes_xp} XP</span></p>
          {result.goal_bonus > 0 && <p className="flex justify-between text-[#B6FF3B]"><span>Daily goal bonus</span><span>+{result.goal_bonus} XP</span></p>}
          {result.streak_bonus > 0 && <p className="flex justify-between text-[#B6FF3B]"><span>7-day streak bonus</span><span>+{result.streak_bonus} XP</span></p>}
          <p className="flex justify-between"><span>Today total</span><span className="text-white">{result.today_minutes} min</span></p>
        </div>

        {result.leveled_up && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#B6FF3B]/30 bg-[#B6FF3B]/10 px-3 py-2.5 text-sm text-[#B6FF3B]">
            <Sparkles size={15} /> Level up — you are now level {result.level} · {result.rank_title}
          </div>
        )}

        {result.goal_hit && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white/80">
            <Flame size={15} className="text-[#B6FF3B]" /> Daily focus goal cleared.
          </div>
        )}

        {unlocked.length > 0 && (
          <div className="mt-3 space-y-2">
            {unlocked.map((a) => (
              <div key={a.code} className="flex items-center gap-2 rounded-xl border border-[#B6FF3B]/25 bg-[#B6FF3B]/5 px-3 py-2.5">
                <Check size={15} className="text-[#B6FF3B]" />
                <div>
                  <p className="text-sm font-semibold text-white">{a.name}</p>
                  <p className="text-xs text-white/40">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onBreak} className="btn-ghost flex-1 text-xs">
            <Zap size={14} /> Take a break
          </button>
          <button type="button" onClick={onClose} className="btn-acid flex-1 text-xs">
            Back to room
          </button>
        </div>
      </motion.div>
    </div>
  );
}