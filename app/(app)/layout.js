import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import AppNav from '@/components/AppNav';

// The signed-in application shell: sidebar (desktop), top bar + bottom nav (mobile), onboarding gate.
export default async function AppLayout({ children }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await sb.from('profiles').select('id,username,display_name,avatar_url,onboarded,is_admin,is_suspended').eq('id', user.id).maybeSingle();
  if (!profile || !profile.onboarded) redirect('/onboarding');
  if (profile.is_suspended) {
    return <main className="m-page"><div className="m-state m-state--error" role="alert"><h1>Account suspended</h1><p>Your account has been suspended by our moderators. Contact support if you think this is a mistake.</p></div></main>;
  }
  return (
    <div className="m-shell">
      <AppNav profile={profile} />
      <div className="m-shell__main">{children}</div>
    </div>
  );
}
