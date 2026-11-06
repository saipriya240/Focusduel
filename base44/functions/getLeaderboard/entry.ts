import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scope = ['global', 'friends'].includes(body.scope) ? body.scope : 'global';
    const period = ['all', 'week', 'month'].includes(body.period) ? body.period : 'all';
    const metric = ['xp', 'focus', 'wins', 'streak'].includes(body.metric) ? body.metric : 'xp';
    const db = base44.asServiceRole.entities;

    const profilesRes = await db.UserProfile.filter({ onboarding_complete: true }, { limit: 250 });
    let profiles = profilesRes.items || [];

    if (scope === 'friends') {
      const friendsRes = await db.Friendship.filter({ user_id: user.id }, { limit: 300 });
      const ids = new Set([user.id, ...(friendsRes.items || []).map((f) => f.friend_id)]);
      profiles = profiles.filter((p) => ids.has(p.created_by_id));
    }

    const focusByUser = {};
    if (period !== 'all') {
      const days = period === 'week' ? 7 : 30;
      const startKey = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      let cursor = null;
      let pages = 0;
      do {
        const options = cursor ? { limit: 500, cursor } : { limit: 500 };
        const page = await db.FocusSession.filter({ date_key: { $gte: startKey } }, options);
        for (const s of page.items || []) {
          focusByUser[s.user_id] = (focusByUser[s.user_id] || 0) + (s.focus_seconds || 0);
        }
        cursor = page.next_cursor;
        pages += 1;
      } while (cursor && pages < 10);
    }

    const rows = profiles.map((p) => {
      const battles = (p.battles_won || 0) + (p.battles_lost || 0);
      return {
        user_id: p.created_by_id,
        username: p.username,
        avatar: p.avatar_url || '',
        level: p.level || 1,
        rank_title: p.rank_title || 'Contender',
        xp: p.xp || 0,
        focus_seconds: period === 'all' ? p.total_focus_seconds || 0 : focusByUser[p.created_by_id] || 0,
        total_focus_seconds: p.total_focus_seconds || 0,
        wins: p.battles_won || 0,
        losses: p.battles_lost || 0,
        win_rate: battles ? Math.round(((p.battles_won || 0) / battles) * 100) : 0,
        streak: p.streak || 0,
        is_me: p.created_by_id === user.id,
      };
    });

    const key = metric === 'focus' ? 'focus_seconds' : metric === 'wins' ? 'wins' : metric === 'streak' ? 'streak' : 'xp';
    rows.sort((a, b) => b[key] - a[key] || b.xp - a.xp);

    const ranked = rows.slice(0, 50).map((r, i) => ({ ...r, rank: i + 1 }));
    const mine = rows.findIndex((r) => r.is_me);

    return Response.json({
      rows: ranked,
      my_rank: mine >= 0 ? mine + 1 : null,
      my_value: mine >= 0 ? rows[mine][key] : 0,
      total_players: rows.length,
      metric,
      period,
      scope,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}