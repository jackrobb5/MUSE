'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import VisibilitySelect from '@/components/VisibilitySelect';
import MediaPlayer from '@/components/MediaPlayer';
import { State } from '@/components/ui';
import { SAMPLE_ACCEPT, checkSample, safeName } from '@/lib/files';
import { SMP_SELECT } from '@/lib/media';
import { VIS_SHORT } from '@/lib/visibility';
import { formatBytes, timeAgo } from '@/lib/format';
import { confetti } from '@/lib/confetti';

export default function MySamples() {
  const sb = supabaseBrowser();
  const { genres } = useTaxonomy();
  const input = useRef(null);
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [f, setF] = useState({ title: '', description: '', genre_id: '', visibility: 'public', rights: false });

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    setMe(user.id);
    const { data, error } = await sb.from('samples').select(SMP_SELECT).eq('owner_id', user.id).order('created_at', { ascending: false });
    if (error) setErr(error.message); else setRows(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault(); setErr(''); setMsg('');
    if (!file) return setErr('Choose an audio or video file.');
    const c = checkSample(file);
    if (c.error) return setErr(c.error);
    if (!f.title.trim()) return setErr('Give your sample a title.');
    if (!f.rights) return setErr('Please confirm you have the right to share this.');
    setBusy(true);
    const path = `${me}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error } = await sb.storage.from('samples').upload(path, file, { contentType: c.type, upsert: false });
    if (error) { setBusy(false); return setErr(error.message); }
    const { error: e2 } = await sb.from('samples').insert({ owner_id: me, title: f.title.trim(), description: f.description.trim() || null,
      genre_id: f.genre_id ? Number(f.genre_id) : null, visibility: f.visibility, file_path: path, mime_type: c.type, size_bytes: file.size, rights_confirmed: true });
    if (e2) { await sb.storage.from('samples').remove([path]); setBusy(false); return setErr(e2.message); }
    setBusy(false); setFile(null); if (input.current) input.current.value = '';
    setF({ ...f, title: '', description: '', rights: false });
    setMsg('Sample posted.'); confetti(); load();
  }
  async function setVis(s, visibility) {
    const { error } = await sb.from('samples').update({ visibility }).eq('id', s.id);
    if (error) setErr(error.message); else load();
  }
  async function remove(s) {
    if (!confirm(`Delete “${s.title}”?`)) return;
    const { error } = await sb.storage.from('samples').remove([s.file_path]);
    if (error) return setErr(error.message);
    const { error: e2 } = await sb.from('samples').delete().eq('id', s.id);
    if (e2) setErr(e2.message); else load();
  }

  return (
    <main className="m-page">
      <header className="m-pagehead"><h1>My samples</h1><Link className="m-btn m-btn--ghost" href="/discover?tab=samples">Browse all samples</Link></header>
      <form className="m-card m-form" onSubmit={submit}>
        <h2>Post a sample</h2>
        <label className="m-field">Audio or video file (MP3, WAV, M4A, AAC, FLAC, OGG, MP4, MOV, WEBM · up to 50 MB)
          <input ref={input} type="file" accept={SAMPLE_ACCEPT} onChange={(e) => setFile(e.target.files[0] || null)} /></label>
        <div className="m-row">
          <label className="m-field">Title *<input value={f.title} maxLength={100} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="m-field">Genre<select value={f.genre_id} onChange={(e) => setF({ ...f, genre_id: e.target.value })}><option value="">Any</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <VisibilitySelect value={f.visibility} onChange={(visibility) => setF({ ...f, visibility })} />
        </div>
        <label className="m-field">Description (optional)<textarea rows={2} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label className="m-check"><input type="checkbox" checked={f.rights} onChange={(e) => setF({ ...f, rights: e.target.checked })} /> I made this or have the right to share it</label>
        {err && <p role="alert" className="m-error">{err}</p>}
        {msg && <p role="status" className="m-muted">{msg}</p>}
        <div className="m-actions"><button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Uploading…' : 'Post sample'}</button></div>
      </form>
      <State loading={!rows && !err} empty={rows && rows.length === 0} emptyTitle="No samples yet" emptyText="Share a clip of something you’ve made. Choose Public or Friends only for each one.">
        <div className="m-grid">
          {rows?.map((s) => (
            <article key={s.id} className="m-card">
              <div className="m-collab__top"><h3>{s.title}</h3><span className="m-chip">{VIS_SHORT[s.visibility]}</span></div>
              <p className="m-muted">{s.genres?.name ? `${s.genres.name} · ` : ''}{formatBytes(s.size_bytes)} · {timeAgo(s.created_at)}</p>
              {s.description && <p className="m-clamp">{s.description}</p>}
              <MediaPlayer bucket="samples" path={s.file_path} mime={s.mime_type} label="Preview" />
              <VisibilitySelect value={s.visibility} onChange={(v) => setVis(s, v)} label="Visibility" />
              <div className="m-actions"><button className="m-btn m-btn--ghost" onClick={() => remove(s)}>Delete</button></div>
            </article>))}
        </div>
      </State>
    </main>
  );
}
