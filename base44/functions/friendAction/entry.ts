import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const db = base44.asServiceRole.entities;

    const myProfiles = await db.UserProfile.filter({ created_by_id: user.id }, { limit: 1 });
    const me = (myProfiles.items || [])[0];
    if (!me) return Response.json({ error: 'Complete onboarding first' }, { status: 400 });

    if (action === 'send') {
      const targetId = String(body.target_user_id || '');
      if (!targetId || targetId === user.id) {
        return Response.json({ error: 'Pick another player' }, { status: 400 });
      }
      const targetRes = await db.UserProfile.filter({ created_by_id: targetId }, { limit: 1 });
      const target = (targetRes.items || [])[0];
      if (!target) return Response.json({ error: 'Player not found' }, { status: 404 });

      const existingFriendship = await db.Friendship.filter(
        { user_id: user.id, friend_id: targetId }, { limit: 1 },
      );
      if ((existingFriendship.items || []).length) {
        return Response.json({ error: 'Already in your squad' }, { status: 409 });
      }
      const pending = await db.FriendRequest.filter(
        { from_user_id: user.id, to_user_id: targetId, status: 'pending' }, { limit: 1 },
      );
      if ((pending.items || []).length) {
        return Response.json({ error: 'Request already sent' }, { status: 409 });
      }

      const request = await db.FriendRequest.create({
        from_user_id: user.id,
        from_username: me.username,
        from_avatar: me.avatar_url || '',
        to_user_id: targetId,
        to_username: target.username,
        status: 'pending',
      });

      if (target.notifications_enabled !== false) {
        await db.Notification.create({
          user_id: targetId,
          type: 'friend_request',
          title: `${me.username} wants to join your squad`,
          body: 'Accept to start duelling.',
          link: '/friends',
        });
      }
      return Response.json({ request });
    }

    if (action === 'accept') {
      const requestId = String(body.request_id || '');
      if (!requestId) return Response.json({ error: 'request_id is required' }, { status: 400 });
      const request = await db.FriendRequest.get(requestId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
      if (request.to_user_id !== user.id) return Response.json({ error: 'Not your request' }, { status: 403 });
      if (request.status !== 'pending') return Response.json({ error: 'Already handled' }, { status: 409 });

      const fromRes = await db.UserProfile.filter({ created_by_id: request.from_user_id }, { limit: 1 });
      const fromProfile = (fromRes.items || [])[0];

      await db.Friendship.create({
        user_id: user.id,
        friend_id: request.from_user_id,
        friend_username: request.from_username,
        friend_avatar: request.from_avatar || '',
      });
      await db.Friendship.create({
        user_id: request.from_user_id,
        friend_id: user.id,
        friend_username: me.username,
        friend_avatar: me.avatar_url || '',
      });
      await db.FriendRequest.update(request.id, { status: 'accepted' });

      if (fromProfile && fromProfile.notifications_enabled !== false) {
        await db.Notification.create({
          user_id: request.from_user_id,
          type: 'friend_accepted',
          title: `${me.username} accepted your request`,
          body: 'You can challenge them to a duel now.',
          link: '/friends',
        });
      }
      return Response.json({ ok: true });
    }

    if (action === 'decline') {
      const requestId = String(body.request_id || '');
      const request = await db.FriendRequest.get(requestId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
      if (request.to_user_id !== user.id) return Response.json({ error: 'Not your request' }, { status: 403 });
      await db.FriendRequest.update(request.id, { status: 'declined' });
      return Response.json({ ok: true });
    }

    if (action === 'remove') {
      const friendId = String(body.friend_id || '');
      if (!friendId) return Response.json({ error: 'friend_id is required' }, { status: 400 });
      await db.Friendship.deleteMany({ user_id: user.id, friend_id: friendId });
      await db.Friendship.deleteMany({ user_id: friendId, friend_id: user.id });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}