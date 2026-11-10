import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req) {
  // CSRF guard: only accept same-origin requests.
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== 'DELETE') return NextResponse.json({ error: 'Confirmation missing' }, { status: 400 });

  const admin = supabaseAdmin();
  for (const bucket of ['avatars', 'covers']) {
    const { data: files } = await admin.storage.from(bucket).list(user.id);
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }
  // Deleting the auth user cascades to profiles and everything referencing it.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: 'Couldn’t delete your account. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
