'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar, State } from '@/components/ui';

export default function FriendsPage() {
  const sb = supabaseBrowser();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('my_friends');
    if (error) setErr(error.message); else setD(data);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function act(fn, args) { setErr(''); const { error } = await sb.rpc(fn, args); if (error) setErr(error.message); else load(); }

  const Person = ({ p, children }) => (
    <div className="m-card m-collab__by">
      <Avatar url={p.avatar_url} name={p.display_name} size={40} />
      <Link href={`/profile/${p.username}`}>{p.display_name}</Link><span className="m-muted">@{p.username}</span>
      <div className="m-actions">{children}</div>
    </div>
  );
  return (
    <main className="m-page">
      <h1>Friends</h1>
      <p className="m-muted">Friends can see the samples and published projects you share as “Friends only”.</p>
      {err && <p role="alert" className="m-error">{err}</p>}
      <State loading={!d && !err} error={!d ? err : ''}>
        {d && (<>
          {d.incoming.length > 0 && <section className="m-stack"><h2>Requests</h2>{d.incoming.map((p) => (
            <Person key={p.id} p={p}>
              <button className="m-btn m-btn--primary" onClick={() => act('respond_friend_request', { p_other: p.id, p_accept: true })}>Accept</button>
              <button className="m-btn m-btn--ghost" onClick={() => act('respond_friend_request', { p_other: p.id, p_accept: false })}>Decline</button>
            </Person>))}</section>}
          <section className="m-stack"><h2>Your friends ({d.friends.length})</h2>
            {d.friends.length === 0 && <div className="m-state"><h3>No friends yet</h3><p>Open an artist’s profile and choose Add friend.</p><Link className="m-btn m-btn--primary" href="/discover">Discover artists</Link></div>}
            {d.friends.map((p) => <Person key={p.id} p={p}><button className="m-btn m-btn--ghost" onClick={() => { if (confirm(`Remove ${p.display_name}?`)) act('remove_friend', { p_other: p.id }); }}>Remove</button></Person>)}</section>
          {d.outgoing.length > 0 && <section className="m-stack"><h2>Sent requests</h2>{d.outgoing.map((p) => (
            <Person key={p.id} p={p}><button className="m-btn m-btn--ghost" onClick={() => act('remove_friend', { p_other: p.id })}>Cancel</button></Person>))}</section>}
        </>)}
      </State>
    </main>
  );
}
