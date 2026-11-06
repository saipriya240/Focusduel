import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Search, Swords, UserMinus, UserPlus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Friends() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [profiles, setProfiles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [activity, setActivity] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [profileRes, friendRes, requestRes, activityRes] = await Promise.all([
      base44.entities.UserProfile.filter({ onboarding_complete: true }, { limit: 120, sort: '-created_date' }),
      base44.entities.Friendship.filter({ user_id: user?.id }, { limit: 200 }),
      base44.entities.FriendRequest.filter({}, { limit: 100, sort: '-created_date' }),
      base44.entities.ActivityFeed.filter({}, { limit: 25, sort: '-created_date' }),
    ]);
    setProfiles(profileRes.items || []);
    setFriends(friendRes.items || []);
    const requests = requestRes.items || [];
    setIncoming(requests.filter((r) => r.to_user_id === user?.id && r.status === 'pending'));
    setOutgoing(requests.filter((r) => r.from_user_id === user?.id && r.status === 'pending'));
    setActivity(activityRes.items || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const act = async (action, payload) => {
    setBusyId(payload.friend_id || payload.request_id || payload.target_user_id);
    setNotice('');
    try {
      const res = await base44.functions.invoke('friendAction', { action, ...payload });
      if (res.data?.error) setNotice(res.data.error);
      else setNotice(action === 'send' ? 'Request sent.' : action === 'accept' ? 'Squad member added.' : action === 'remove' ? 'Removed from squad.' : 'Request declined.');
      await load();
    } catch (e) {
      setNotice(e?.response?.data?.error || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const friendIds = new Set(friends.map((f) => f.friend_id));
  const outgoingIds = new Set(outgoing.map((r) => r.to_user_id));
  const results = profiles
    .filter((p) => p.created_by_id !== user?.id)
    .filter((p) => (query ? p.username?.toLowerCase().includes(query.toLowerCase()) || p.display_name?.toLowerCase().includes(query.toLowerCase()) : true))
    .slice(0, query ? 20 : 8);

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Squad</p>
        <h1 className="mt-1 text-4xl sm:text-5xl">Your <span className="text-[#B6FF3B]">people.</span></h1>
        <p className="mt-2 max-w-lg text-sm text-white/40">Duels, roasts and rankings only feel real when someone else is watching.</p>
      </div>

      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/50">{notice}</p>}

      {incoming.length > 0 && (
        <section className="panel p-4">
          <p className="label-xs">Requests for you ({incoming.length})</p>
          <div className="mt-3 space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  {r.from_avatar ? <img src={r.from_avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-white/40">{r.from_username?.charAt(0).toUpperCase()}</span>}
                </div>
                <p className="flex-1 truncate text-sm font-semibold">{r.from_username}</p>
                <button type="button" onClick={() => act('accept', { request_id: r.id })} disabled={busyId === r.id} className="rounded-lg bg-[#B6FF3B] px-2.5 py-1.5 text-[#08090A]" aria-label="Accept">
                  {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button type="button" onClick={() => act('decline', { request_id: r.id })} disabled={busyId === r.id} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-white/50" aria-label="Decline">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="label-xs">Find players</p>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{profiles.length} contenders</span>
          </div>
          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username"
              className="field pl-9"
            />
          </div>

          {loading ? (
            <div className="grid place-items-center py-12"><Loader2 className="animate-spin text-white/30" size={20} /></div>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/35">No players found. Invite friends to FocusDuel to build the squad.</p>
          ) : (
            <div className="mt-3 divide-y divide-white/5">
              {results.map((p) => {
                const isFriend = friendIds.has(p.created_by_id);
                const requested = outgoingIds.has(p.created_by_id);
                return (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-white/40">{p.username?.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.username}</p>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">LVL {p.level || 1} · {p.streak || 0}d streak</p>
                    </div>
                    {isFriend ? (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#B6FF3B]">Squad</span>
                    ) : requested ? (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">Pending</span>
                    ) : (
                      <button type="button" onClick={() => act('send', { target_user_id: p.created_by_id })} disabled={busyId === p.created_by_id} className="btn-ghost px-3 py-1.5 text-[10px]">
                        {busyId === p.created_by_id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel p-5">
            <p className="label-xs">Your squad ({friends.length})</p>
            {friends.length === 0 ? (
              <p className="mt-3 text-sm text-white/35">Nobody yet. Send a request and start a rivalry.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {friends.map((f) => (
                  <div key={f.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                    <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                      {f.friend_avatar ? <img src={f.friend_avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-[11px] text-white/40">{f.friend_username?.charAt(0).toUpperCase()}</span>}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{f.friend_username}</p>
                    <Link to={`/battles?challenge=${f.friend_id}`} className="rounded-lg border border-[#B6FF3B]/30 bg-[#B6FF3B]/10 p-1.5 text-[#B6FF3B]" aria-label="Challenge">
                      <Swords size={13} />
                    </Link>
                    <button type="button" onClick={() => act('remove', { friend_id: f.friend_id })} disabled={busyId === f.friend_id} className="rounded-lg border border-white/10 p-1.5 text-white/35 hover:text-red-400" aria-label="Remove friend">
                      <UserMinus size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel p-5">
            <p className="label-xs">Squad activity</p>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-white/35">Sessions and victories from your squad will land here.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <div className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      a.type === 'battle_win' ? 'bg-[#B6FF3B]' : a.type === 'level_up' ? 'bg-purple-400' : a.type === 'goal' ? 'bg-amber-400' : 'bg-white/30')} />
                    <div className="min-w-0">
                      <p className="text-xs leading-relaxed text-white/70">{a.message}</p>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">{timeAgo(a.created_date)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="text-center font-mono text-[9px] uppercase tracking-widest text-white/20">
        {profile?.activity_visibility === 'private' ? 'Your activity is private — only you see your entries' : 'Activity is shared with your squad'}
      </p>
    </div>
  );
}