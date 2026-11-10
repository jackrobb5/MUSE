'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar, State } from './ui';
import MusicEmbed from './MusicEmbed';
import { COMP, WORK } from '@/lib/labels';
import { timeAgo } from '@/lib/format';

const SELECT = '*, sender:profiles!sender_id(username,display_name,avatar_url), recipient:profiles!recipient_id(username,display_name,avatar_url), collaborations(title), musical_roles(name), genres(name)';

export default function RequestsPanel() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [reply, setReply] = useState({});

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    setMe(user.id);
    const { data, error } = await sb.from('collaboration_requests').select(SELECT).order('created_at', { ascending: false }).limit(100);
    if (error) setErr(error.message); else setRows(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(promise, then) {
    const { data, error } = await promise;
    if (error) return setErr(error.message);
    setErr('');
    if (then) then(data); else load();
  }
  const respond = (r, status) => act(sb.rpc('respond_to_request', { p_id: r.id, p_status: status, p_response: reply[r.id] || null }));
  const withdraw = (r) => act(sb.rpc('withdraw_request', { p_id: r.id }));
  const toProject = (r) => act(sb.rpc('create_project_from_request', { p_request: r.id }), (pid) => router.push(`/projects/${pid}`));

  const incoming = rows?.filter((r) => r.recipient_id === me) || [];
  const outgoing = rows?.filter((r) => r.sender_id === me) || [];

  const Card = ({ r, mine }) => {
    const other = mine ? r.recipient : r.sender;
    return (
      <article className="m-card">
        <header className="m-collab__by">
          <Avatar url={other?.avatar_url} name={other?.display_name} size={32} />
          <Link href={`/profile/${other?.username}`}>{other?.display_name}</Link>
          <span className={`m-chip m-chip--${r.status}`}>{r.status}</span>
          <span className="m-muted">{timeAgo(r.created_at)}</span>
        </header>
        {r.collaborations?.title && <p className="m-muted">For: {r.collaborations.title}</p>}
        <p className="m-prewrap">{r.description}</p>
        <p className="m-muted">{[r.musical_roles?.name, r.genres?.name, WORK[r.work_pref]].filter(Boolean).join(' · ')}</p>
        {r.message && <blockquote className="m-prewrap">{r.message}</blockquote>}
        {r.music_link && <MusicEmbed url={r.music_link} title="Music reference" />}
        {r.response_message && <p className="m-muted">Reply: {r.response_message}</p>}
        <div className="m-actions">
          {!mine && r.status === 'pending' && (<>
            <input aria-label="Optional reply message" placeholder="Optional message with your reply" value={reply[r.id] || ''} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} maxLength={1000} />
            <button className="m-btn m-btn--primary" onClick={() => respond(r, 'accepted')}>Accept</button>
            <button className="m-btn m-btn--ghost" onClick={() => respond(r, 'declined')}>Decline</button>
          </>)}
          {mine && r.status === 'pending' && <button className="m-btn m-btn--ghost" onClick={() => withdraw(r)}>Withdraw</button>}
          {r.status === 'accepted' && (r.project_id
            ? <Link className="m-btn m-btn--primary" href={`/projects/${r.project_id}`}>Open project</Link>
            : <button className="m-btn m-btn--primary" onClick={() => toProject(r)}>Start a project</button>)}
        </div>
      </article>
    );
  };

  return (
    <State loading={!rows && !err} error={!rows ? err : ''} empty={rows && rows.length === 0} emptyTitle="No requests yet"
      emptyText="Request a collaboration from someone’s profile, or apply to a listing. Requests you send and receive appear here.">
      {err && <p role="alert" className="m-error">{err}</p>}
      <h2>Received</h2>
      {incoming.length === 0 ? <p className="m-muted">Nothing received yet.</p> : incoming.map((r) => <Card key={r.id} r={r} mine={false} />)}
      <h2>Sent</h2>
      {outgoing.length === 0 ? <p className="m-muted">Nothing sent yet.</p> : outgoing.map((r) => <Card key={r.id} r={r} mine />)}
    </State>
  );
}
