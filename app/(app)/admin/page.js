import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import AdminDashboard from '@/components/AdminDashboard';

export const metadata = { title: 'Admin · MUSE' };

// UX gate only. The real protection is Row Level Security + admin_stats() checking is_admin() inside Postgres.
export default async function AdminPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) notFound();
  const { data } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!data?.is_admin) notFound();
  return <main className="m-page"><h1>Admin</h1><AdminDashboard /></main>;
}
