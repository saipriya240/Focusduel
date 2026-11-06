import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  XP, ACHIEVEMENTS, levelFromXp, rankTitle, dateKey, localHour, daysBetween, clamp,
} from '../../shared/gamification.ts';

const CATEGORIES = ['deep_work', 'study', 'building', 'creative', 'admin'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const planned = clamp(Math.round(Number(body.planned_minutes) || 0), 1, 180);
    const focusSeconds = clamp(Math.round(Number(body.focus_seconds) || 0), 0, planned * 60);
    const pausedCount = clamp(Math.round(Number(body.paused_count) || 0), 0, 300);
    const category = CATEGORIES.includes(body.category) ? body.category : 'deep_work';
    const battleId = typeof body.battle_id === 'string' ? body.battle_id : undefined;
    const completed = focusSeconds >= planned * 60 * 0.98;

    const profiles = await base44.asServiceRole.entities.UserProfile.filter(
      { created_by_id: user.id }, { limit: 1 },
    );
    const profile = (profiles.items || [])[0];
    if (!profile) return Response.json({ error: 'Complete onboarding first' }, { status: 400 });

    const tz = profile.timezone || 'UTC';
    const now = new Date();
    const today = dateKey(now, tz);
    const minutes = focusSeconds / 60;

    const minutesXp = clamp(
      Math.round(completed ? minutes * XP.perFocusMinute : minutes * XP.partialRate),
      0,
      150,
    );

    const session = await base44.asServiceRole.entities.FocusSession.create({
      user_id: user.id,
      category,
      planned_minutes: planned,
      focus_seconds: focusSeconds,
      paused_count: pausedCount,
      completed,
      started_at: body.started_at || new Date(now.getTime() - focusSeconds * 1000).toISOString(),
      ended_at: now.toISOString(),
      date_key: today,
      hour_key: localHour(now, tz),
      xp_awarded: minutesXp,
      ...(battleId ? { battle_id: battleId } : {}),
    });

    // ---- streak ----
    let streak = profile.streak || 0;
    if (completed && profile.last_session_date !== today) {
      streak = profile.last_session_date && daysBetween(profile.last_session_date, today) === 1
        ? streak + 1
        : 1;
    }

    // ---- daily goal (bonus awarded once per local day) ----
    const todays = await base44.asServiceRole.entities.FocusSession.filter(
      { user_id: user.id, date_key: today }, { limit: 200 },
    );
    const todaySeconds = (todays.items || []).reduce((sum, s) => sum + (s.focus_seconds || 0), 0);
    const goalHit = todaySeconds >= (profile.daily_target_minutes || 120) * 60;
    const goalBonus = goalHit && profile.last_goal_bonus_date !== today ? XP.dailyGoalBonus : 0;
    const streakBonus = completed && streak > 0 && streak % 7 === 0 ? XP.streakBonus : 0;

    const gained = minutesXp + goalBonus + streakBonus;
    const newXp = (profile.xp || 0) + gained;
    const lvl = levelFromXp(newXp);
    const leveledUp = lvl.level > (profile.level || 1);

    await base44.asServiceRole.entities.UserProfile.update(profile.id, {
      xp: newXp,
      level: lvl.level,
      rank_title: rankTitle(lvl.level),
      streak,
      longest_streak: Math.max(profile.longest_streak || 0, streak),
      last_session_date: completed ? today : profile.last_session_date,
      last_goal_bonus_date: goalBonus ? today : profile.last_goal_bonus_date,
      total_focus_seconds: (profile.total_focus_seconds || 0) + focusSeconds,
      sessions_completed: (profile.sessions_completed || 0) + (completed ? 1 : 0),
    });

    // ---- achievements (each code unlocks once) ----
    const owned = await base44.asServiceRole.entities.UserAchievement.filter(
      { user_id: user.id }, { limit: 100 },
    );
    const ownedCodes = new Set((owned.items || []).map((a) => a.code));
    const candidates = [];
    const sessionsDone = (profile.sessions_completed || 0) + (completed ? 1 : 0);
    const totalFocus = (profile.total_focus_seconds || 0) + focusSeconds;

    if (sessionsDone >= 5) candidates.push('no_distractions');
    if (totalFocus >= 5 * 3600) candidates.push('locked_in');
    if (streak >= 7) candidates.push('unstoppable');
    if (completed && planned >= 60) candidates.push('deep_diver');

    const unlocked = [];
    for (const code of candidates) {
      if (ownedCodes.has(code)) continue;
      const def = ACHIEVEMENTS[code];
      if (!def) continue;
      await base44.asServiceRole.entities.UserAchievement.create({
        user_id: user.id,
        code,
        name: def.name,
        description: def.description,
        unlocked_at: now.toISOString(),
      });
      unlocked.push({ code, ...def });
      if (profile.notifications_enabled !== false) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'achievement',
          title: `Achievement unlocked: ${def.name}`,
          body: def.description,
          link: '/settings',
        });
      }
    }

    // ---- activity + audience ----
    const friends = await base44.asServiceRole.entities.Friendship.filter(
      { user_id: user.id }, { limit: 200 },
    );
    const audience = [user.id, ...(friends.items || []).map((f) => f.friend_id)];
    const username = profile.username || 'a contender';
    const visibility = profile.activity_visibility || 'friends';

    if (visibility !== 'private' && completed) {
      await base44.asServiceRole.entities.ActivityFeed.create({
        actor_id: user.id,
        actor_username: username,
        actor_avatar: profile.avatar_url || '',
        type: 'session',
        message: `${username} locked in for ${Math.round(minutes)} focused minutes.`,
        meta: `${Math.round(minutes)}m`,
        audience_ids: visibility === 'public' ? audience : audience,
      });
      if (goalBonus) {
        await base44.asServiceRole.entities.ActivityFeed.create({
          actor_id: user.id,
          actor_username: username,
          actor_avatar: profile.avatar_url || '',
          type: 'goal',
          message: `${username} smashed today's focus goal.`,
          meta: `${Math.round(todaySeconds / 60)}m`,
          audience_ids: audience,
        });
      }
    }

    if (leveledUp && visibility !== 'private') {
      await base44.asServiceRole.entities.ActivityFeed.create({
        actor_id: user.id,
        actor_username: username,
        actor_avatar: profile.avatar_url || '',
        type: 'level_up',
        message: `${username} hit level ${lvl.level}.`,
        meta: `LVL ${lvl.level}`,
        audience_ids: audience,
      });
    }

    return Response.json({
      session,
      xp_awarded: gained,
      minutes_xp: minutesXp,
      goal_bonus: goalBonus,
      streak_bonus: streakBonus,
      total_xp: newXp,
      level: lvl.level,
      rank_title: rankTitle(lvl.level),
      leveled_up: leveledUp,
      streak,
      goal_hit: goalHit,
      today_minutes: Math.round(todaySeconds / 60),
      achievements: unlocked,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}