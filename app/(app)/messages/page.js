'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar, State } from '@/components/ui';
import MusicEmbed from '@/components/MusicEmbed';
import { timeAgo } from '@/lib/format';
import { parseMusicLink } from '@/lib/embed';

const sb = () => supabaseBrowser();
const COLS = 'id,sender_id,content,project_id,request_id,created_at';

export default function MessagesPage() {
  const [me, setMe] = useState(null);
  const [convs, setConvs] = useState(null);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState('');

  const loadConvs = useCallback(async () => {
    const { data, error } = await sb().rpc('my_conversations');
    if (error) setErr(error.message); else setConvs(data);
  }, []);

  useEffect(() => {
    sb().auth.getUser().then(({ data }) => setMe(data.user?.id));
    loadConvs();
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) setActive(c);
    // Any new message we're allowed to see (RLS applies to realtime) refreshes the conversation list.
    const ch = sb().channel('inbox').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadConvs).subscribe();
    return () => { sb().removeChannel(ch); };
  }, [loadConvs]);

  const conv = convs?.find((c) => c.id === active);
  return (
    <main className="m-page m-msgs" data-view={active ? 'thread' : 'list'}>
      <aside className="m-conv-list" aria-label="Conversations">
        <h1>Messages</h1>
        <State loading={!convs && !err} error={!convs ? err : ''} empty={convs && convs.length === 0} emptyTitle="No conversations yet"
          emptyText="Open an artist’s profile and choose Send message, or reply to a collaboration request."
          action={<Link className="m-btn m-btn--primary" href="/discover">Discover artists</Link>}>
          <ul className="m-plain">
            {convs?.map((c) => (
              <li key={c.id}>
                <button className="m-conv" aria-current={c.id === active} onClick={() => setActive(c.id)}>
                  <Avatar url={c.avatar_url} name={c.display_name} size={40} />
                  <span className="m-conv__text"><strong>{c.display_name}</strong><span className="m-muted m-clamp1">{c.last_message || 'No messages yet'}</span></span>
                  {c.unread > 0 && <span className="m-badge" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
        </State>
      </aside>
      <section className="m-thread" aria-label="Conversation">
        {conv && me
          ? <Thread key={conv.id} conv={conv} me={me} onBack={() => setActive(null)} onRead={loadConvs} />
          : <div className="m-state"><h3>Select a conversation</h3><p>Your messages appear here in real time.</p></div>}
      </section>
    </main>
  );
}

function Bubble({ m, mine }) {
  const isUrl = /^https?:\/\/\S+$/.test(m.content);
  return (
    <div className={`m-bubble${mine ? ' is-mine' : ''}`}>
      {m.project_id && <Link className="m-link" href={`/projects/${m.project_id}`}>Shared project →</Link>}
      {isUrl && parseMusicLink(m.content) ? <MusicEmbed url={m.content} /> : <p className="m-prewrap">{m.content}</p>}
      <time className="m-muted" dateTime={m.created_at}>{timeAgo(m.created_at)}</time>
    </div>
  );
}

function Thread({ conv, me, onBack, onRead }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [projects, setProjects] = useState([]);
  const endRef = useRef(null);

  const markRead = useCallback(() => sb().rpc('mark_conversation_read', { p_conversation: conv.id }).then(onRead), [conv.id, onRead]);

  useEffect(() => {
    let live = true;
    sb().from('messages').select(COLS).eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(100).then(({ data, error }) => {
      if (!live) return;
      if (error) return setErr(error.message);
      setMsgs(data.reverse());
      markRead();
    });
    sb().from('projects').select('id,title').neq('status', 'archived').then(({ data }) => live && setProjects(data || []));
    const ch = sb().channel(`thread:${conv.id}`).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` },
      (p) => { setMsgs((m) => (m && !m.some((x) => x.id === p.new.id) ? [...m, p.new] : m)); markRead(); }).subscribe();
    return () => { live = false; sb().removeChannel(ch); };
  }, [conv.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  async function insert(row) {
    const { data, error } = await sb().from('messages').insert({ conversation_id: conv.id, sender_id: me, ...row }).select(COLS).single();
    if (error) { setErr(error.message); return false; }
    setErr('');
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
    return true;
  }
  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    if (!(await insert({ content }))) setText(content);
  }

  return (
    <>
      <header className="m-thread__head">
        <button className="m-btn m-btn--ghost m-only-mobile" onClick={onBack} aria-label="Back to conversations">←</button>
        <Link href={`/profile/${conv.username}`} className="m-collab__by"><Avatar url={conv.avatar_url} name={conv.display_name} size={36} /><strong>{conv.display_name}</strong></Link>
      </header>
      <div className="m-thread__body" role="log" aria-live="polite">
        <State loading={!msgs && !err} error={!msgs ? err : ''} empty={msgs && msgs.length === 0} emptyTitle="Say hello" emptyText="Introduce yourself, share a track link, or mention what you’d like to make together.">
          {msgs?.map((m) => <Bubble key={m.id} m={m} mine={m.sender_id === me} />)}
        </State>
        <div ref={endRef} />
      </div>
      {err && msgs && <p role="alert" className="m-error">{err}</p>}
      <form className="m-composer" onSubmit={send}>
        {projects.length > 0 && (
          <select aria-label="Share a project" value="" onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); if (p) insert({ content: `Shared a project: ${p.title}`, project_id: p.id }); }}>
            <option value="">Share project…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Write a message or paste a music link" />
        <button className="m-btn m-btn--primary" disabled={!text.trim()}>Send</button>
      </form>
    </>
  );
}
