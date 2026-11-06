import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { base44 } from '@/api/base44Client';
import { Flame, Loader2, Sparkles, Wand2 } from 'lucide-react';
import PostCard from '@/components/shame/PostCard';
import { cn } from '@/lib/utils';

const INTENSITIES = [
  { key: 'mild', label: 'Mild' },
  { key: 'savage', label: 'Savage' },
  { key: 'extra_spicy', label: 'Extra spicy' },
];

export default function HallOfShame() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState('');
  const [actual, setActual] = useState('');
  const [intensity, setIntensity] = useState('savage');
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState('');
  const [audience, setAudience] = useState([]);

  const load = useCallback(async () => {
    const [postRes, likeRes, friendRes] = await Promise.all([
      base44.entities.ShamePost.filter({}, { sort: '-created_date', limit: 40 }),
      base44.entities.ShameLike.filter({ user_id: user?.id }, { limit: 200 }),
      user?.id ? base44.entities.Friendship.filter({ user_id: user.id }, { limit: 200 }) : Promise.resolve({ items: [] }),
    ]);
    setPosts(postRes.items || []);
    setLikedIds((likeRes.items || []).map((l) => l.post_id));
    setAudience([user?.id, ...(friendRes.items || []).map((f) => f.friend_id)]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setNotice('');
    try {
      const res = await base44.functions.invoke('generateRoast', {
        intensity,
        goal_text: goal,
        actual_text: actual,
        username: profile?.username || 'me',
      });
      if (res.data?.error) setNotice(res.data.error);
      else setDraft(res.data.roast);
    } catch (e) {
      setNotice(e?.response?.data?.error || 'Roast machine is offline. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await base44.entities.ShamePost.create({
        author_id: user.id,
        author_username: profile?.username || 'contender',
        author_avatar: profile?.avatar_url || '',
        content: draft.trim(),
        goal_text: goal.trim(),
        intensity,
        ai_generated: true,
        audience_ids: audience,
      });
      setDraft('');
      setGoal('');
      setActual('');
      setNotice('Posted to your squad feed.');
      await load();
    } finally {
      setPosting(false);
    }
  };

  const optedOut = profile && profile.public_roasts === false;

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Hall of shame</p>
        <h1 className="mt-1 text-4xl sm:text-5xl">Missed it? <span className="text-[#B6FF3B]">Own it.</span></h1>
        <p className="mt-2 max-w-xl text-sm text-white/40">
          Confess the missed goal, let the roast host do the damage, and let your squad laugh with you. Private to your friends by default.
        </p>
      </div>

      {optedOut ? (
        <div className="panel p-6 text-center">
          <Flame className="mx-auto text-white/20" size={26} />
          <p className="mt-3 font-heading text-2xl">Roasts are switched off</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/35">
            You opted out of public roasts. You can still read your squad's posts — flip it back on in settings.
          </p>
        </div>
      ) : (
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <Wand2 size={15} className="text-[#B6FF3B]" />
            <p className="label-xs">Generate a roast</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-xs">What you promised</span>
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="4 hours of deep work" className="field mt-1.5 text-sm" maxLength={140} />
            </label>
            <label className="block">
              <span className="label-xs">What actually happened</span>
              <input value={actual} onChange={(e) => setActual(e.target.value)} placeholder="17 reels and a nap" className="field mt-1.5 text-sm" maxLength={140} />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {INTENSITIES.map((i) => (
              <button
                key={i.key}
                type="button"
                onClick={() => setIntensity(i.key)}
                className={cn('rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition',
                  intensity === i.key ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]' : 'border-white/10 text-white/45 hover:border-white/25')}
              >
                {i.label}
              </button>
            ))}
            <button type="button" onClick={generate} disabled={generating} className="btn-ghost ml-auto text-xs">
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Roast me
            </button>
          </div>

          {draft && (
            <div className="mt-4 rounded-xl border border-[#B6FF3B]/25 bg-[#B6FF3B]/5 p-4">
              <p className="text-[15px] leading-relaxed text-white/90">{draft}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={publish} disabled={posting} className="btn-acid px-4 py-2 text-xs">
                  {posting ? <Loader2 size={13} className="animate-spin" /> : null} Post to squad
                </button>
                <button type="button" onClick={generate} disabled={generating} className="btn-ghost px-3 py-2 text-xs">Regenerate</button>
              </div>
            </div>
          )}

          {notice && <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-white/40">{notice}</p>}
        </section>
      )}

      {loading ? (
        <div className="panel grid place-items-center py-20"><Loader2 className="animate-spin text-white/30" size={22} /></div>
      ) : posts.length === 0 ? (
        <div className="panel px-6 py-16 text-center">
          <Flame className="mx-auto text-white/20" size={28} />
          <p className="mt-4 font-heading text-2xl">No confessions yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/35">Nobody in your squad has fessed up. Be the brave one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              liked={likedIds.includes(p.id)}
              mine={p.author_id === user?.id}
              onChanged={load}
              onReported={() => setNotice('Reported. Moderators will review it.')}
            />
          ))}
        </div>
      )}
    </div>
  );
}