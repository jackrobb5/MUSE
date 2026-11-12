'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar, CopyrightNotice, State } from '@/components/ui';
import MusicEmbed from '@/components/MusicEmbed';
import ProjectRoleSelect from '@/components/ProjectRoleSelect';
import PublishPanel from '@/components/PublishPanel';
import { isSafeHttpUrl } from '@/lib/embed';
import { PROJECT_STATUS } from '@/lib/labels';
import { formatBytes, timeAgo } from '@/lib/format';
import { ACCEPT, checkFile, kindOf, safeName } from '@/lib/files';

const TABS = ['Updates', 'Links', 'Files', 'Notes', 'Agreed terms', 'People'];
const BUCKET = 'project-files';
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

function Uploader({ projectId, me, onDone, onError }) {
  const sb = supabaseBrowser();
  const input = useRef(null);
  const [busy, setBusy] = useState('');
  const [over, setOver] = useState(false);

  async function upload(files) {
    onError('');
    for (const file of [...files]) {
      const c = checkFile(file);
      if (c.error) { onError(c.error); continue; }
      setBusy(`Uploading ${file.name}…`);
      const path = `${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: c.type, upsert: false });
      if (error) { onError(`${file.name}: ${error.message}`); continue; }
      const { error: e2 } = await sb.from('project_files').insert({ project_id: projectId, uploaded_by: me, name: file.name.slice(0, 200), path, mime_type: c.type, size_bytes: file.size });
      if (e2) { await sb.storage.from(BUCKET).remove([path]); onError(`${file.name}: ${e2.message}`); }
    }
    setBusy('');
    onDone();
  }
  return (
    <div className={`m-drop${over ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
      <p><strong>Drag files here</strong> or <button type="button" className="m-link-btn" onClick={() => input.current?.click()}>browse your computer</button></p>
      <p className="m-muted">MP4, MOV, WEBM, MP3, WAV, M4A, FLAC, OGG, MIDI, images, PDF, ZIP, TXT · up to 50 MB each</p>
      <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      {busy && <p role="status" className="m-muted"><span className="m-spinner" aria-hidden="true" /> {busy}</p>}
    </div>
  );
}

function FileRow({ f, me, isOwner, onChanged, onError }) {
  const sb = supabaseBrowser();
  const [url, setUrl] = useState(null);
  const kind = kindOf(f.mime_type);
  const canDelete = f.uploaded_by === me || isOwner;

  async function sign(download) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.path, 3600, download ? { download: f.name } : undefined);
    if (error) { onError(error.message); return null; }
    return data.signedUrl;
  }
  async function preview() {
    if (url) return setUrl(null);
    const u = await sign(false);
    if (!u) return;
    if (f.mime_type === 'application/pdf') window.open(u, '_blank', 'noopener'); else setUrl(u);
  }
  async function download() {
    const u = await sign(true);
    if (!u) return;
    const a = document.createElement('a'); a.href = u; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  }
  async function remove() {
    if (!confirm(`Delete “${f.name}”?`)) return;
    const { error } = await sb.storage.from(BUCKET).remove([f.path]);
    if (error) return onError(error.message);
    const { error: e2 } = await sb.from('project_files').delete().eq('id', f.id);
    if (e2) onError(e2.message); else onChanged();
  }
  const canPreview = ['video', 'audio', 'image'].includes(kind) || f.mime_type === 'application/pdf';
  return (
    <article className="m-card">
      <div className="m-collab__by"><strong className="m-clamp1">{f.name}</strong><span className="m-chip">{kind === 'file' ? (f.name.split('.').pop() || 'file').toUpperCase() : kind}</span></div>
      <p className="m-muted">{formatBytes(f.size_bytes)} · {f.uploader?.display_name} · {timeAgo(f.created_at)}</p>
      {url && kind === 'video' && <video className="m-media" src={url} controls preload="metadata" playsInline />}
      {url && kind === 'audio' && <audio className="m-media" src={url} controls preload="metadata" />}
      {url && kind === 'image' && <img className="m-media" src={url} alt={f.name} />}
      <div className="m-actions">
        {canPreview && <button className="m-btn m-btn--ghost" onClick={preview}>{url ? 'Hide' : f.mime_type === 'application/pdf' ? 'Open' : 'Preview'}</button>}
        <button className="m-btn m-btn--ghost" onClick={download}>Download</button>
        {canDelete && <button className="m-btn m-btn--ghost" onClick={remove}>Delete</button>}
      </div>
    </article>
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
      project_files(id,name,path,mime_type,size_bytes,uploaded_by,created_at,uploader:profiles!uploaded_by(display_name)),
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
  async function deleteProject() {
    if (!confirm('Delete this project and its files for everyone? This can’t be undone.')) return;
    const paths = (p.project_files || []).map((f) => f.path);
    if (paths.length) await sb.storage.from(BUCKET).remove(paths);
    run(sb.from('projects').delete().eq('id', id)).then((ok) => ok && router.push('/projects'));
  }
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
            {isOwner && <button className="m-btn m-btn--ghost" onClick={deleteProject}>Delete project</button>}
          </header>
          <PublishPanel project={p} files={p.project_files} isOwner={isOwner} />
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

          {tab === 'Files' && <section className="m-stack">
            <Uploader projectId={id} me={me} onDone={load} onError={setErr} />
            <p className="m-notice">Only upload music and files you have the right to share. Files are private to this project’s members.</p>
            {p.project_files.length === 0 && <p className="m-muted">No files yet. Share demos, stems, mixes, videos or references.</p>}
            {[...p.project_files].sort(byNewest).map((f) => <FileRow key={f.id} f={f} me={me} isOwner={isOwner} onChanged={load} onError={setErr} />)}
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
                <Link href={`/profile/${m.profile?.username}`}>{m.profile?.display_name}</Link>{isOwner && m.user_id !== me
                  ? <ProjectRoleSelect label="Role" value={m.role} onChange={(role) => run(sb.from('project_members').update({ role }).match({ project_id: id, user_id: m.user_id }), 'Role updated.')} />
                  : <span className="m-chip">{m.role}</span>}
                {isOwner && m.user_id !== me && <button className="m-btn m-btn--ghost" onClick={() => run(sb.from('project_members').delete().match({ project_id: id, user_id: m.user_id }), 'Collaborator removed.')}>Remove</button>}
                {!isOwner && m.user_id === me && <button className="m-btn m-btn--ghost" onClick={() => { if (confirm('Leave this project?')) run(sb.from('project_members').delete().match({ project_id: id, user_id: me })).then((ok) => ok && router.push('/projects')); }}>Leave</button>}
              </div>))}
            {isOwner && (
              <form className="m-card m-form" onSubmit={inviteUser}>
                <h3>Add a collaborator</h3>
                <div className="m-row">
                  <label className="m-field">Username<input value={invite.username} onChange={(e) => setInvite({ ...invite, username: e.target.value })} required /></label>
                  <ProjectRoleSelect value={invite.role} onChange={(role) => setInvite({ ...invite, role })} />
                  <button className="m-btn m-btn--primary">Add</button>
                </div>
              </form>)}
          </section>}
        </>)}
      </State>
    </main>
  );
}
