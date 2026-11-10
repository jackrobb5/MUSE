'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar, CopyrightNotice, State } from '@/components/ui';
import MusicEmbed from '@/components/MusicEmbed';
import { isSafeHttpUrl } from '@/lib/embed';
import { PROJECT_STATUS } from '@/lib/labels';
import { timeAgo } from '@/lib/format';

const TABS = ['Updates', 'Links', 'Notes', 'Agreed terms', 'People'];
const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

function AddForm({ placeholder, onSubmit, rows = 3, button = 'Post', type = 'text' }) {
  const [v, setV] = useState('');
  return (
    <form className="m-form" onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) return; if (await onSubmit(v.trim())) setV(''); }}>
      {rows > 1
        ? <textarea aria-label={placeholder} placeholder={placeholder} rows={rows} value={v} onChange={(e) => setV(e.target.value)} maxLength={8000} />
        : <input aria-label={placeholder} placeholder={placeholder} type={type} value={v} onChange={(e) => setV(e.target.value)} maxLength={500} />}
      <button className="m-btn m-btn--primary" disabled={!v.trim()}>{button}</button>
    </form>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const sb = supabaseBrowser();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [p, setP] = useState(null);
  const [tab, setTab] = useState('Updates');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [invite, setInvite] = useState({ username: '', role: 'Collaborator' });

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    setMe(user.id);
    const { data, error } = await sb.from('projects').select(`id,title,description,status,progress,creator_id,created_at,
      project_members(user_id,role,profile:profiles!user_id(username,display_name,avatar_url)),
      project_updates(id,content,created_at,author:profiles!author_id(display_name,username)),
      project_links(id,url,label,added_by,created_at),
      project_notes(id,kind,content,created_at,author_id,author:profiles!author_id(display_name))`).eq('id', id).maybeSingle();
    if (error) setErr(error.message); else if (!data) setErr('Project not found, or you aren’t a member.'); else setP(data);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function run(promise, ok = '') {
    const { error } = await promise;
    if (error) { setMsg(''); setErr(error.message); return false; }
    setErr(''); setMsg(ok); load(); return true;
  }
  const isOwner = p?.creator_id === me;
  const patch = (fields) => run(sb.from('projects').update(fields).eq('id', id));

  async function inviteUser(e) {
    e.preventDefault();
    const { data: u } = await sb.from('profiles').select('id').eq('username', invite.username.trim().toLowerCase().replace(/^@/, '')).maybeSingle();
    if (!u) return setErr('No artist with that username.');
    run(sb.from('project_members').insert({ project_id: id, user_id: u.id, role: invite.role.trim() || 'Collaborator' }), 'Collaborator added. They’ve been notified.');
    setInvite({ username: '', role: 'Collaborator' });
  }

  return (
    <main className="m-page">
      <State loading={!p && !err} error={!p ? err : ''}>
        {p && (<>
          <Link className="m-link" href="/projects">← All projects</Link>
          <header className="m-card">
            <h1>{p.title}</h1>
            {p.description && <p className="m-prewrap">{p.description}</p>}
            <div className="m-row">
              <label className="m-field">Status
                <select value={p.status} disabled={!isOwner} onChange={(e) => patch({ status: e.target.value, ...(e.target.value === 'completed' ? { progress: 100 } : {}) })}>
                  {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="m-field">Progress ({p.progress}%)
                <input type="range" min="0" max="100" step="5" value={p.progress} disabled={!isOwner} onChange={(e) => setP({ ...p, progress: Number(e.target.value) })} onMouseUp={(e) => patch({ progress: Number(e.target.value) })} onTouchEnd={(e) => patch({ progress: Number(e.target.value) })} onKeyUp={(e) => patch({ progress: Number(e.target.value) })} /></label>
            </div>
            {isOwner && p.status !== 'completed' && <button className="m-btn m-btn--ghost" onClick={() => patch({ status: 'completed', progress: 100 })}>Mark complete</button>}
            {isOwner && <button className="m-btn m-btn--ghost" onClick={() => { if (confirm('Delete this project for everyone? This can’t be undone.')) run(sb.from('projects').delete().eq('id', id)).then((ok) => ok && router.push('/projects')); }}>Delete project</button>}
          </header>
          {err && <p role="alert" className="m-error">{err}</p>}
          {msg && <p role="status" className="m-muted">{msg}</p>}

          <div className="m-tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className="m-tab" onClick={() => setTab(t)}>{t}</button>)}</div>

          {tab === 'Updates' && <section className="m-stack">
            <AddForm placeholder="Share an update with the team" onSubmit={(content) => run(sb.from('project_updates').insert({ project_id: id, author_id: me, content }))} />
            {p.project_updates.length === 0 && <p className="m-muted">No updates yet. Post what you’ve done or what you need next.</p>}
            {[...p.project_updates].sort(byNewest).map((u) => <article key={u.id} className="m-card"><p className="m-prewrap">{u.content}</p><p className="m-muted">{u.author?.display_name} · {timeAgo(u.created_at)}</p></article>)}
          </section>}

          {tab === 'Links' && <section className="m-stack">
            <AddForm placeholder="Paste a reference link (https://…)" rows={1} type="url" button="Add link"
              onSubmit={async (url) => { if (!isSafeHttpUrl(url)) { setErr('Enter a valid http(s) link.'); return false; } return run(sb.from('project_links').insert({ project_id: id, added_by: me, url })); }} />
            {p.project_links.length === 0 && <p className="m-muted">Share references, stems folders or demos here.</p>}
            {[...p.project_links].sort(byNewest).map((l) => <div key={l.id} className="m-card"><MusicEmbed url={l.url} title={l.label} />
              {(l.added_by === me || isOwner) && <button className="m-btn m-btn--ghost" onClick={() => run(sb.from('project_links').delete().eq('id', l.id))}>Remove</button>}</div>)}
          </section>}

          {['Notes', 'Agreed terms'].includes(tab) && (() => {
            const kind = tab === 'Notes' ? 'note' : 'agreed_terms';
            return (
              <section className="m-stack">
                {kind === 'agreed_terms' && <CopyrightNotice />}
                <AddForm placeholder={kind === 'note' ? 'Add a note' : 'Record what you’ve agreed (splits, credits, fees, deadlines)'} button={kind === 'note' ? 'Add note' : 'Record terms'}
                  onSubmit={(content) => run(sb.from('project_notes').insert({ project_id: id, author_id: me, kind, content }))} />
                {p.project_notes.filter((n) => n.kind === kind).sort(byNewest).map((n) => (
                  <article key={n.id} className="m-card"><p className="m-prewrap">{n.content}</p>
                    <p className="m-muted">{n.author?.display_name} · {timeAgo(n.created_at)}</p>
                    {(n.author_id === me || isOwner) && <button className="m-btn m-btn--ghost" onClick={() => run(sb.from('project_notes').delete().eq('id', n.id))}>Delete</button>}</article>))}
              </section>
            );
          })()}

          {tab === 'People' && <section className="m-stack">
            {p.project_members.map((m) => (
              <div key={m.user_id} className="m-card m-collab__by">
                <Avatar url={m.profile?.avatar_url} name={m.profile?.display_name} size={40} />
                <Link href={`/profile/${m.profile?.username}`}>{m.profile?.display_name}</Link><span className="m-chip">{m.role}</span>
                {isOwner && m.user_id !== me && <button className="m-btn m-btn--ghost" onClick={() => run(sb.from('project_members').delete().match({ project_id: id, user_id: m.user_id }), 'Collaborator removed.')}>Remove</button>}
                {!isOwner && m.user_id === me && <button className="m-btn m-btn--ghost" onClick={() => { if (confirm('Leave this project?')) run(sb.from('project_members').delete().match({ project_id: id, user_id: me })).then((ok) => ok && router.push('/projects')); }}>Leave</button>}
              </div>))}
            {isOwner && (
              <form className="m-card m-form" onSubmit={inviteUser}>
                <h3>Add a collaborator</h3>
                <div className="m-row">
                  <label className="m-field">Username<input value={invite.username} onChange={(e) => setInvite({ ...invite, username: e.target.value })} required /></label>
                  <label className="m-field">Their role<input value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} maxLength={60} /></label>
                  <button className="m-btn m-btn--primary">Add</button>
                </div>
              </form>)}
          </section>}
        </>)}
      </State>
    </main>
  );
}
