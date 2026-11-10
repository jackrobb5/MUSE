import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

// "My Profile" nav item: send people to their own public profile.
export default async function MyProfile() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
  redirect(data?.username ? `/profile/${data.username}` : '/profile/edit');
}
