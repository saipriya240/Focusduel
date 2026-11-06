import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Plus, Swords, Timer } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { categoryLabel, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import ChallengeModal from '@/components/battles/ChallengeModal';

const STATUS_STYLES = {
  pending: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  active: 'border-[#B6FF3B]/40 bg-[#B6FF3B]/10 text-[#B6FF3B]',
  completed: 'border-white/15 bg-white/5 text-white/60',
  declined: 'border-red-400/30 bg-red-400/10 text-red-400',
  cancelled: 'border-red-400/30 bg-red-400/10 text-red-400',
  expired: 'border-white/10 bg-white/5 text-white/40',
};

export default function Battles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [battles, setBattles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(Boolean(params.get('challenge')));
  const [tab, setTab] = useState('live');

  const load = useCallback(async () => {
    const [battleRes, friendRes] = await Promise.all([
      base44.entities.Battle.filter({}, { sort: '-created_date', limit: 50 }),
      user?.id ? base44.entities.Friendship.filter({ user_id: user.id }, { limit: 100 }) : Promise.resolve({ items: [] }),
    ]);
    setBattles(battleRes.items || []);
    setFriends(friendRes.items || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const unsubscribe = base44.entities.Battle.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  const live = battles.filter((b) => b.status === 'active');
  const incoming = battles.filter((b) => b.status === 'pending' && b.opponent_id === user?.id);
  const outgoing = battles.filter((b) => b.status === 'pending' && b.challenger_id === user?.id);
  const history = battles.filter((b) => ['completed', 'declined', 'cancelled', 'expired'].includes(b.status));

  const lists = { live, incoming, outgoing, history };
  const visible = lists[tab] || [];

  const rival = (b) => (b.challenger_id === user?.id
    ? { name: b.opponent_username, avatar: b.opponent_avatar }
    : { name: b.challenger_username, avatar: b.challenger_avatar });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Duels</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Lock in <span className="text-[#B6FF3B]">together.</span></h1>
          <p className="mt-2 max-w-lg text-sm text-white/40">Same clock. Same stakes. Whoever actually focuses wins.</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn-acid text-xs">
          <Plus size={14} /> New battle
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'live', label: `Live (${live.length})` },
          { key: 'incoming', label: `Invites (${incoming.length})` },
          { key: 'outgoing', label: `Sent (${outgoing.length})` },
          { key: 'history', label: `History (${history.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest transition',
              tab === t.key ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/45 hover:border-white/25'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel grid place-items-center py-16">
          <Loader2 className="animate-spin text-white/30" size={22} />
        </div>
      ) : visible.length === 0 ? (
        <div className="panel px-6 py-16 text-center">
          <Swords className="mx-auto text-white/20" size={30} />
          <p className="mt-4 font-heading text-2xl">No duels here yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/35">
            {tab === 'incoming'
              ? 'Nobody has challenged you. Send the first shot.'
              : 'Challenge a squad member and put XP on the line.'}
          </p>
          <button type="button" onClick={() => setShowModal(true)} className="btn-ghost mx-auto mt-5 text-xs">
            <Plus size={14} /> Start one
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((b) => {
            const r = rival(b);
            const myScore = b.challenger_id === user?.id ? b.challenger_focus_seconds : b.opponent_focus_seconds;
            const theirScore = b.challenger_id === user?.id ? b.opponent_focus_seconds : b.challenger_focus_seconds;
            const won = b.winner_id === user?.id;
            return (
              <Link key={b.id} to={`/battles/${b.id}`} className="panel panel-hover block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                      {r.avatar ? <img src={r.avatar} alt="" className="h-full w-full object-cover" /> : <span className="font-heading text-base text-white/40">{r.name?.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">vs {r.name}</p>
                      <p className="text-xs text-white/35">{b.duration_minutes} min · {categoryLabel(b.category)} · {b.xp_stake} XP</p>
                    </div>
                  </div>
                  <span className={cn('rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest', STATUS_STYLES[b.status])}>
                    {b.status}
                  </span>
                </div>

                {b.status === 'active' && (
                  <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
                    <Timer size={11} className="text-[#B6FF3B]" /> {Math.round(myScore / 60)}m vs {Math.round(theirScore / 60)}m · live now
                  </div>
                )}

                {b.status === 'completed' && (
                  <p className={cn('mt-3 font-mono text-[10px] uppercase tracking-widest', won ? 'text-[#B6FF3B]' : b.is_draw ? 'text-white/50' : 'text-red-400')}>
                    {b.is_draw ? 'Draw' : won ? 'Victory' : 'Defeat'} · {Math.round(myScore / 60)}m vs {Math.round(theirScore / 60)}m
                  </p>
                )}

                {b.status === 'pending' && (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-white/35">
                    {b.opponent_id === user?.id ? 'Your move — accept or decline' : 'Waiting for your rival'} · {timeAgo(b.created_date)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {showModal && (
        <ChallengeModal
          friends={friends}
          defaultFriendId={params.get('challenge') || ''}
          onClose={() => setShowModal(false)}
          onCreated={(battle) => {
            setShowModal(false);
            if (battle?.id) navigate(`/battles/${battle.id}`);
          }}
        />
      )}
    </div>
  );
}