'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import AccountDataControls from '@/components/AccountDataControls';
import { Avatar } from '@/components/ui';

export default function SettingsPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [blocked, setBlocked] = useState([]);

  const loadBlocks = useCallback(async () => {
    const { data } = await sb.from('blocks').select('blocked_id,profile:profiles!blocked_id(username,display_name,avatar_url)');
    setBlocked(data || []);
  }, []);
  useEffect(() => { sb.auth.getUser().then(({ data }) => setEmail(data.user?.email || '')); loadBlocks(); }, [loadBlocks]);

  async function changePw(e) {
    e.preventDefault(); setMsg(null);
    if (pw.length < 8) return setMsg({ error: true, text: 'Use at least 8 characters.' });
    const { error } = await sb.auth.updateUser({ password: pw });
    setMsg(error ? { error: true, text: error.message } : { text: 'Password updated.' }); if (!error) setPw('');
  }
  async function unblock(id) {
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('blocks').delete().match({ blocker_id: user.id, blocked_id: id }); loadBlocks();
  }
  async function signOut() { await sb.auth.signOut(); router.push('/login'); router.refresh(); }

  return (
    <main className="m-page">
      <h1>Settings</h1>
      <section className="m-card"><h2>Account</h2><p className="m-muted">Signed in as {email}</p>
        <form className="m-form" onSubmit={changePw}>
          <label className="m-field">New password<input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          {msg && <p role={msg.error ? 'alert' : 'status'} className={msg.error ? 'm-error' : 'm-muted'}>{msg.text}</p>}
          <div className="m-actions"><button className="m-btn m-btn--primary">Change password</button><button type="button" className="m-btn m-btn--ghost" onClick={signOut}>Log out</button></div>
        </form></section>
      <section className="m-card"><h2>Privacy and notifications</h2>
        <p><Link className="m-link" href="/profile/edit">Edit profile and location privacy</Link></p>
        <p><Link className="m-link" href="/notifications">Notification preferences</Link></p></section>
      <section className="m-card"><h2>Blocked users</h2>
        {blocked.length === 0 ? <p className="m-muted">You haven’t blocked anyone.</p> : blocked.map((b) => (
          <div key={b.blocked_id} className="m-collab__by"><Avatar url={b.profile?.avatar_url} name={b.profile?.display_name} size={32} />{b.profile?.display_name}
            <button className="m-btn m-btn--ghost" onClick={() => unblock(b.blocked_id)}>Unblock</button></div>))}</section>
      <AccountDataControls />
    </main>
  );
}
