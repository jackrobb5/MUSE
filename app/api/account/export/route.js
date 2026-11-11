import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Everything is read with the user's own session, so RLS limits it to what they can legitimately see.
export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const me = user.id;
  const q = (t, col) => sb.from(t).select('*').eq(col, me).then((r) => r.data ?? []);
  const [profile, artist, roles, genres, collabs, sent, received, messages, projects, favourites, blocks, reports, notifications, prefs, files] = await Promise.all([
    sb.from('profiles').select('*').eq('id', me).maybeSingle().then((r) => r.data),
    sb.from('artist_profiles').select('*').eq('user_id', me).maybeSingle().then((r) => r.data),
    q('user_roles', 'user_id'), q('user_genres', 'user_id'), q('collaborations', 'creator_id'),
    q('collaboration_requests', 'sender_id'), q('collaboration_requests', 'recipient_id'), q('messages', 'sender_id'),
    q('project_members', 'user_id'), q('favourites', 'user_id'), q('blocks', 'blocker_id'), q('reports', 'reporter_id'),
    q('notifications', 'user_id'), q('notification_prefs', 'user_id'), q('project_files', 'uploaded_by'),
  ]);
  const body = { exported_at: new Date().toISOString(), account: { id: me, email: user.email, created_at: user.created_at },
    profile, artist_profile: artist, roles, genres, collaborations: collabs, requests_sent: sent, requests_received: received,
    messages_sent: messages, project_memberships: projects, favourites, blocks, reports_made: reports, notifications, notification_prefs: prefs, project_files_uploaded: files };
  return new NextResponse(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="muse-data-export.json"', 'Cache-Control': 'no-store' } });
}
