import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { XP, ACHIEVEMENTS, levelFromXp, rankTitle, clamp } from '../../shared/gamification.ts';

const CATEGORIES = ['deep_work', 'study', 'building', 'creative', 'admin'];
const ALLOWED_DURATIONS = [15, 25, 45, 60];
const PING_CAP_SECONDS = 30;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const db = base44.asServiceRole.entities;

    const loadProfile = async (userId) => {
      const res = await db.UserProfile.filter({ created_by_id: userId }, { limit: 1 });
      return (res.items || [])[0] || null;
    };

    const notify = async (userId, title, msg, link, type) => {
      const target = await loadProfile(userId);
      if (target && target.notifications_enabled === false) return;
      await db.Notification.create({ user_id: userId, type, title, body: msg, link });
    };

    if (action === 'create') {
      const opponentId = String(body.opponent_id || '');
      const duration = Number(body.duration_minutes);
      const stake = clamp(Math.round(Number(body.xp_stake) || XP.defaultBattleStake), 0, 200);
      const category = CATEGORIES.includes(body.category) ? body.category : 'deep_work';
      if (!opponentId) return Response.json({ error: 'Pick a rival' }, { status: 400 });
      if (opponentId === user.id) return Response.json({ error: 'You cannot duel yourself' }, { status: 400 });
      if (!ALLOWED_DURATIONS.includes(duration)) {
        return Response.json({ error: 'Duration must be 15, 25, 45 or 60 minutes' }, { status: 400 });
      }

      const me = await loadProfile(user.id);
      const rival = await loadProfile(opponentId);
      if (!me) return Response.json({ error: 'Complete onboarding first' }, { status: 400 });
      if (!rival) return Response.json({ error: 'That player does not exist' }, { status: 404 });

      const friendship = await db.Friendship.filter({ user_id: user.id, friend_id: opponentId }, { limit: 1 });
      if (!(friendship.items || []).length) {
        return Response.json({ error: 'You can only duel players on your friends list' }, { status: 403 });
      }
      if (rival.battle_invites_enabled === false) {
        return Response.json({ error: 'This player is not accepting battle invites' }, { status: 403 });
      }

      const battle = await db.Battle.create({
        challenger_id: user.id,
        challenger_username: me.username,
        challenger_avatar: me.avatar_url || '',
        opponent_id: opponentId,
        opponent_username: rival.username,
        opponent_avatar: rival.avatar_url || '',
        invited_by: user.id,
        duration_minutes: duration,
        category,
        xp_stake: stake,
        status: 'pending',
        rematch_of: typeof body.rematch_of === 'string' ? body.rematch_of : undefined,
      });

      await notify(opponentId, `${me.username} challenged you`, `${duration} min · ${category.replace('_', ' ')} duel. ${stake} XP on the line.`, `/battles/${battle.id}`, 'battle_invite');
      return Response.json({ battle });
    }

    const battleId = String(body.battle_id || '');
    if (!battleId) return Response.json({ error: 'battle_id is required' }, { status: 400 });
    const battle = await db.Battle.get(battleId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!battle) return Response.json({ error: 'Battle not found' }, { status: 404 });

    const isChallenger = battle.challenger_id === user.id;
    const isOpponent = battle.opponent_id === user.id;
    if (!isChallenger && !isOpponent) return Response.json({ error: 'Not your battle' }, { status: 403 });
    const now = new Date();

    if (action === 'accept') {
      if (!isOpponent) return Response.json({ error: 'Only the challenged player can accept' }, { status: 403 });
      if (battle.status !== 'pending') return Response.json({ error: 'This battle is no longer pending' }, { status: 409 });
      const startsAt = now;
      const endsAt = new Date(now.getTime() + battle.duration_minutes * 60000);
      const updated = await db.Battle.update(battle.id, {
        status: 'active',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        challenger_joined: true,
        opponent_joined: true,
        challenger_last_ping: startsAt.toISOString(),
        opponent_last_ping: startsAt.toISOString(),
      });
      await notify(battle.challenger_id, 'Battle is live', `${battle.opponent_username} accepted. The clock is running.`, `/battles/${battle.id}`, 'battle_invite');
      return Response.json({ battle: updated });
    }

    if (action === 'decline' || action === 'cancel') {
      if (battle.status !== 'pending') return Response.json({ error: 'This battle is no longer pending' }, { status: 409 });
      const updated = await db.Battle.update(battle.id, {
        status: action === 'decline' ? 'declined' : 'cancelled',
      });
      const otherId = isOpponent ? battle.challenger_id : battle.opponent_id;
      await notify(otherId, action === 'decline' ? 'Challenge declined' : 'Challenge withdrawn', 'No XP changed hands.', `/battles/${battle.id}`, 'battle_result');
      return Response.json({ battle: updated });
    }

    if (action === 'ping') {
      if (battle.status !== 'active') return Response.json({ error: 'Battle is not active' }, { status: 409 });
      if (now.getTime() > new Date(battle.ends_at).getTime()) {
        return Response.json({ error: 'Battle clock has ended', ended: true }, { status: 409 });
      }
      const focused = body.focused === true;
      const lastPingIso = isChallenger ? battle.challenger_last_ping : battle.opponent_last_ping;
      const currentSeconds = (isChallenger ? battle.challenger_focus_seconds : battle.opponent_focus_seconds) || 0;
      const currentPaused = (isChallenger ? battle.challenger_paused : battle.opponent_paused) || 0;

      let added = 0;
      if (focused && lastPingIso) {
        const delta = Math.round((now.getTime() - new Date(lastPingIso).getTime()) / 1000);
        if (delta > 0) added = Math.min(delta, PING_CAP_SECONDS);
      }

      const patch = isChallenger
        ? {
            challenger_focus_seconds: Math.min(currentSeconds + added, battle.duration_minutes * 60),
            challenger_paused: currentPaused + (body.paused === true ? 1 : 0),
            challenger_last_ping: now.toISOString(),
            challenger_joined: true,
          }
        : {
            opponent_focus_seconds: Math.min(currentSeconds + added, battle.duration_minutes * 60),
            opponent_paused: currentPaused + (body.paused === true ? 1 : 0),
            opponent_last_ping: now.toISOString(),
            opponent_joined: true,
          };

      const updated = await db.Battle.update(battle.id, patch);
      return Response.json({ battle: updated });
    }

    if (action === 'finish') {
      if (battle.status === 'completed') return Response.json({ battle });
      if (battle.status !== 'active') return Response.json({ error: 'Battle was never active' }, { status: 409 });
      if (now.getTime() < new Date(battle.ends_at).getTime() - 3000) {
        return Response.json({ error: 'Battle clock is still running' }, { status: 409 });
      }

      const cScore = battle.challenger_focus_seconds || 0;
      const oScore = battle.opponent_focus_seconds || 0;
      const isDraw = cScore === oScore;
      const winnerId = isDraw ? null : cScore > oScore ? battle.challenger_id : battle.opponent_id;
      const loserId = isDraw ? null : cScore > oScore ? battle.opponent_id : battle.challenger_id;
      const stake = battle.xp_stake || XP.defaultBattleStake;

      const settle = async (userId, won, draw, gainedXp) => {
        const p = await loadProfile(userId);
        if (!p) return;
        const newXp = Math.max(0, (p.xp || 0) + gainedXp);
        const lvl = levelFromXp(newXp);
        await db.UserProfile.update(p.id, {
          xp: newXp,
          level: lvl.level,
          rank_title: rankTitle(lvl.level),
          battles_won: (p.battles_won || 0) + (won ? 1 : 0),
          battles_lost: (p.battles_lost || 0) + (!won && !draw ? 1 : 0),
          win_streak: won ? (p.win_streak || 0) + 1 : draw ? p.win_streak || 0 : 0,
          total_focus_seconds: (p.total_focus_seconds || 0) + (userId === battle.challenger_id ? cScore : oScore),
        });
        return p;
      };

      await settle(battle.challenger_id, winnerId === battle.challenger_id, isDraw, isDraw ? Math.round(stake / 2) : winnerId === battle.challenger_id ? stake : 0);
      await settle(battle.opponent_id, winnerId === battle.opponent_id, isDraw, isDraw ? Math.round(stake / 2) : winnerId === battle.opponent_id ? stake : 0);

      // Record the duel as focus sessions so analytics include it in both players' histories.
      for (const [userId, seconds] of [[battle.challenger_id, cScore], [battle.opponent_id, oScore]]) {
        if (seconds <= 0) continue;
        await db.FocusSession.create({
          user_id: userId,
          category: battle.category,
          planned_minutes: battle.duration_minutes,
          focus_seconds: seconds,
          paused_count: 0,
          completed: seconds >= battle.duration_minutes * 60 * 0.9,
          started_at: battle.starts_at,
          ended_at: battle.ends_at,
          date_key: new Date(battle.starts_at).toISOString().slice(0, 10),
          hour_key: new Date(battle.starts_at).getUTCHours(),
          xp_awarded: 0,
          battle_id: battle.id,
        });
      }

      // First Blood / Focus Legend for the winner.
      if (winnerId) {
        const winner = await loadProfile(winnerId);
        if (winner) {
          const owned = await db.UserAchievement.filter({ user_id: winnerId }, { limit: 50 });
          const codes = new Set((owned.items || []).map((a) => a.code));
          const toUnlock = [];
          if (!codes.has('first_blood')) toUnlock.push('first_blood');
          if ((winner.battles_won || 0) >= 10 && !codes.has('focus_legend')) toUnlock.push('focus_legend');
          for (const code of toUnlock) {
            const def = ACHIEVEMENTS[code];
            await db.UserAchievement.create({
              user_id: winnerId, code, name: def.name, description: def.description, unlocked_at: now.toISOString(),
            });
            await notify(winnerId, `Achievement unlocked: ${def.name}`, def.description, '/settings', 'achievement');
          }
        }
      }

      const updated = await db.Battle.update(battle.id, {
        status: 'completed',
        winner_id: winnerId || '',
        is_draw: isDraw,
        settled_at: now.toISOString(),
      });

      const winnerName = isDraw ? null : winnerId === battle.challenger_id ? battle.challenger_username : battle.opponent_username;
      await notify(battle.challenger_id, isDraw ? 'Battle ended in a draw' : winnerId === battle.challenger_id ? 'Victory' : 'Defeat', isDraw ? 'Evenly matched. Run it back?' : `${winnerName} took the duel.`, `/battles/${battle.id}`, 'battle_result');
      await notify(battle.opponent_id, isDraw ? 'Battle ended in a draw' : winnerId === battle.opponent_id ? 'Victory' : 'Defeat', isDraw ? 'Evenly matched. Run it back?' : `${winnerName} took the duel.`, `/battles/${battle.id}`, 'battle_result');

      if (winnerId) {
        const winnerProfile = await loadProfile(winnerId);
        const friends = await db.Friendship.filter({ user_id: winnerId }, { limit: 200 });
        const audience = [winnerId, ...(friends.items || []).map((f) => f.friend_id)];
        if (winnerProfile && winnerProfile.activity_visibility !== 'private') {
          await db.ActivityFeed.create({
            actor_id: winnerId,
            actor_username: winnerProfile.username,
            actor_avatar: winnerProfile.avatar_url || '',
            type: 'battle_win',
            message: `${winnerProfile.username} won a ${battle.duration_minutes}-minute focus duel.`,
            meta: `${battle.duration_minutes}m duel`,
            audience_ids: audience,
          });
        }
      }

      return Response.json({ battle: updated, winner_id: winnerId, is_draw: isDraw });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}