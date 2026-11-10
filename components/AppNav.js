'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar } from './ui';
import NotificationBadge from './NotificationBadge';

// Swap the glyphs for your icon set (e.g. lucide-react) if you prefer.
const ITEMS = [['/', 'Home', '⌂'], ['/discover', 'Discover', '◎'], ['/collaborations', 'Collaborations', '✦'], ['/messages', 'Messages', '✉'],
  ['/projects', 'My Projects', '♫'], ['/notifications', 'Notifications', '◔'], ['/profile', 'My Profile', '☺'], ['/settings', 'Settings', '⚙']];
const MOBILE = ['/', '/discover', '/collaborations', '/messages', '/projects'];

export default function AppNav({ profile }) {
  const path = usePathname();
  const router = useRouter();
  const items = profile.is_admin ? [...ITEMS, ['/admin', 'Admin', '⛨']] : ITEMS;
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));

  useEffect(() => {
    try { if (sessionStorage.getItem('muse_active')) return; sessionStorage.setItem('muse_active', '1'); } catch { /* storage unavailable */ }
    supabaseBrowser().from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', profile.id).then(() => {});
  }, [profile.id]);

  async function signOut() { await supabaseBrowser().auth.signOut(); router.push('/login'); router.refresh(); }
  const Link1 = ({ it, mobile }) => (
    <Link href={it[0]} className="m-nav__link" aria-current={active(it[0]) ? 'page' : undefined}>
      <span aria-hidden="true" className="m-nav__icon">{it[2]}</span><span className={mobile ? 'm-nav__label--sm' : ''}>{it[1]}</span>{it[0] === '/notifications' && <NotificationBadge />}
    </Link>
  );
  return (
    <>
      <aside className="m-sidebar">
        <Link href="/" className="m-logo">MUSE</Link>
        <nav aria-label="Main">{items.map((it) => <Link1 key={it[0]} it={it} />)}</nav>
        <div className="m-sidebar__me"><Avatar url={profile.avatar_url} name={profile.display_name} size={36} /><span className="m-clamp1">{profile.display_name}</span>
          <button className="m-btn m-btn--ghost" onClick={signOut}>Log out</button></div>
      </aside>
      <header className="m-topbar">
        <Link href="/" className="m-logo">MUSE</Link>
        <div className="m-actions">
          <Link className="m-btn m-btn--ghost" href="/notifications" aria-label="Notifications">◔<NotificationBadge /></Link>
          <Link className="m-btn m-btn--ghost" href="/profile" aria-label="My profile">☺</Link>
          <Link className="m-btn m-btn--ghost" href="/settings" aria-label="Settings">⚙</Link>
        </div>
      </header>
      <nav className="m-bottomnav" aria-label="Primary">{ITEMS.filter((i) => MOBILE.includes(i[0])).map((it) => <Link1 key={it[0]} it={it} mobile />)}</nav>
    </>
  );
}
