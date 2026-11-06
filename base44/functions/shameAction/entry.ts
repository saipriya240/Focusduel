import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const postId = String(body.post_id || '');
    if (!postId) return Response.json({ error: 'post_id is required' }, { status: 400 });
    const db = base44.asServiceRole.entities;

    const post = await db.ShamePost.get(postId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    if (!(post.audience_ids || []).includes(user.id)) {
      return Response.json({ error: 'This post is not shared with you' }, { status: 403 });
    }

    const myProfiles = await db.UserProfile.filter({ created_by_id: user.id }, { limit: 1 });
    const me = (myProfiles.items || [])[0];

    if (action === 'like') {
      const existing = await db.ShameLike.filter({ post_id: postId, user_id: user.id }, { limit: 1 });
      const has = (existing.items || []).length > 0;
      if (has) {
        await db.ShameLike.delete((existing.items || [])[0].id);
      } else {
        await db.ShameLike.create({ post_id: postId, user_id: user.id, username: me?.username || '' });
      }
      const count = await db.ShameLike.count({ post_id: postId });
      await db.ShamePost.update(postId, { like_count: count });
      return Response.json({ liked: !has, like_count: count });
    }

    if (action === 'comment') {
      const content = String(body.content || '').trim().slice(0, 300);
      if (!content) return Response.json({ error: 'Say something first' }, { status: 400 });
      const comment = await db.ShameComment.create({
        post_id: postId,
        author_id: user.id,
        author_username: me?.username || 'contender',
        author_avatar: me?.avatar_url || '',
        content,
        audience_ids: post.audience_ids || [post.author_id],
      });
      const count = await db.ShameComment.count({ post_id: postId });
      await db.ShamePost.update(postId, { comment_count: count });
      return Response.json({ comment, comment_count: count });
    }

    if (action === 'report') {
      const reports = (post.report_count || 0) + 1;
      await db.ShamePost.update(postId, { report_count: reports });
      return Response.json({ reported: true, report_count: reports });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}