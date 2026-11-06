import { useState } from 'react';
import { Flag, Heart, MessageCircle, Send, Share2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const INTENSITY_STYLE = {
  mild: 'border-white/15 text-white/50',
  savage: 'border-amber-400/30 text-amber-300',
  extra_spicy: 'border-red-500/40 text-red-400',
};

export default function PostCard({ post, liked, mine, onChanged, onReported }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiked, setIsLiked] = useState(liked);

  const loadComments = async () => {
    setLoading(true);
    const res = await base44.entities.ShameComment.filter({ post_id: post.id }, { sort: 'created_date', limit: 50 });
    setComments(res.items || []);
    setLoading(false);
  };

  const toggleComments = () => {
    const next = !open;
    setOpen(next);
    if (next) loadComments();
  };

  const like = async () => {
    const res = await base44.functions.invoke('shameAction', { action: 'like', post_id: post.id });
    setIsLiked(res.data.liked);
    setLikeCount(res.data.like_count);
  };

  const comment = async () => {
    if (!draft.trim()) return;
    const res = await base44.functions.invoke('shameAction', { action: 'comment', post_id: post.id, content: draft });
    if (res.data.comment) {
      setComments((c) => [...c, res.data.comment]);
      setDraft('');
      onChanged?.();
    }
  };

  const share = async () => {
    const text = `${post.author_username} on FocusDuel: ${post.content}`;
    try {
      if (navigator.share) await navigator.share({ title: 'FocusDuel', text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* dismissed */
    }
  };

  const remove = async () => {
    await base44.entities.ShamePost.delete(post.id);
    onChanged?.();
  };

  const report = async () => {
    await base44.functions.invoke('shameAction', { action: 'report', post_id: post.id });
    onReported?.();
  };

  return (
    <article className="panel p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          {post.author_avatar
            ? <img src={post.author_avatar} alt="" className="h-full w-full object-cover" />
            : <span className="font-heading text-base text-white/40">{post.author_username?.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{post.author_username}</p>
            <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest', INTENSITY_STYLE[post.intensity])}>
              {post.intensity?.replace('_', ' ')}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{timeAgo(post.created_date)}</span>
          </div>
          {post.goal_text && (
            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/25">Goal: {post.goal_text}</p>
          )}
          <p className="mt-2 text-[15px] leading-relaxed text-white/90">{post.content}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-3">
        <button type="button" onClick={like} className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition hover:bg-white/5', isLiked ? 'text-[#B6FF3B]' : 'text-white/40')}>
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} /> {likeCount}
        </button>
        <button type="button" onClick={toggleComments} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/40 transition hover:bg-white/5 hover:text-white">
          <MessageCircle size={14} /> {comments.length || post.comment_count || 0}
        </button>
        <button type="button" onClick={share} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/40 transition hover:bg-white/5 hover:text-white">
          <Share2 size={14} />
        </button>
        <div className="ml-auto flex items-center gap-1">
          {mine ? (
            <button type="button" onClick={remove} className="rounded-lg p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-400" aria-label="Delete post">
              <Trash2 size={14} />
            </button>
          ) : (
            <button type="button" onClick={report} className="rounded-lg p-2 text-white/25 transition hover:bg-white/5 hover:text-white/70" aria-label="Report post">
              <Flag size={13} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          {loading ? (
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">No comments yet</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                <p className="text-[11px] font-semibold text-white/80">{c.author_username}</p>
                <p className="text-xs text-white/55">{c.content}</p>
              </div>
            ))
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && comment()}
              placeholder="Add a comment…"
              className="field py-2 text-xs"
              maxLength={300}
            />
            <button type="button" onClick={comment} className="btn-acid px-3 py-2" aria-label="Send comment">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}