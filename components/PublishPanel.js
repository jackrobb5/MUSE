'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import VisibilitySelect from './VisibilitySelect';
import { VIS_SHORT } from '@/lib/visibility';
import { formatBytes, timeAgo } from '@/lib/format';
import { confetti } from '@/lib/confetti';

function PublishDialog({ project, media, genres, rel, onClose, onDone }) {
  const sb = supabaseBrowser();
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const [f, setF] = useState({ title: rel?.title || project.title, description: rel?.description ?? project.description ?? '', genre_id: rel?.genre_id ?? '', visibility: rel?.visibility || 'public', rights: false });
  const [picked, setPicked] = useState([...(rel?.release_tracks || [])].sort((a, b) => a.position - b.position).map((t) => t.file_id).filter((id) => media.some((m) => m.id === id)));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 10 ? [...p, id] : p));

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!f.title.trim()) return setErr('Add a title.');
    if (picked.length === 0) return setErr('Choose at least one track to feature.');
    if (!f.rights) return setErr('Please confirm you have the right to publish this.');
    setBusy(true);
    const { error } = await sb.rpc('publish_project', { p_project: project.id, p_title: f.title.trim(), p_description: f.description.trim() || null,
      p_genre: f.genre_id ? Number(f.genre_id) : null, p_visibility: f.visibility, p_file_ids: picked, p_rights: true });
    setBusy(false);
    if (error) return setErr(error.message);
    confetti(); onDone(); onClose();
  }
  return (
    <dialog ref={ref} className="m-dialog" onClose={onClose} aria-labelledby="pub-title">
      <form className="m-form" onSubmit={submit}>
        <h2 id="pub-title">{rel ? 'Edit published project' : 'Publish to Discover'}</h2>
        <label className="m-field">Title *<input value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="m-field">Description<textarea rows={3} maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="m-row">
          <label className="m-field">Genre<select value={f.genre_id} onChange={(e) => setF({ ...f, genre_id: e.target.value })}><option value="">Any</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <VisibilitySelect value={f.visibility} onChange={(visibility) => setF({ ...f, visibility })} label="Who can listen?" />
        </div>
        <fieldset className="m-field"><legend>Tracks to feature (up to 10, in the order you tick them) *</legend>
          {media.map((m) => (
            <label className="m-check" key={m.id}><input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
              {picked.includes(m.id) && <span className="m-chip">#{picked.indexOf(m.id) + 1}</span>} {m.name} <span className="m-muted">{formatBytes(m.size_bytes)}</span></label>))}
        </fieldset>
        <p className="m-notice">Everyone on the project is credited with their role, and they’ll be notified. Only audio and video files from the Files tab can be featured.</p>
        <label className="m-check"><input type="checkbox" checked={f.rights} onChange={(e) => setF({ ...f, rights: e.target.checked })} /> I have the right to publish this, and my collaborators have agreed</label>
        {err && <p role="alert" className="m-error">{err}</p>}
        <div className="m-actions"><button type="button" className="m-btn m-btn--ghost" onClick={() => ref.current?.close()}>Cancel</button>
          <button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Publishing…' : rel ? 'Save changes' : 'Publish'}</button></div>
      </form>
    </dialog>
  );
}

export default function PublishPanel({ project, files, isOwner }) {
  const sb = supabaseBrowser();
  const { genres } = useTaxonomy();
  const [rel, setRel] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const media = (files || []).filter((f) => /^(audio|video)\//.test(f.mime_type || ''));

  const load = useCallback(async () => {
    const { data, error } = await sb.from('releases').select('id,title,description,genre_id,visibility,published_at,release_tracks(file_id,position)').eq('project_id', project.id).maybeSingle();
    if (error) setErr(error.message); else setRel(data);
  }, [project.id, project.status]);
  useEffect(() => { load(); }, [load]);

  async function setVis(visibility) {
    const { error } = await sb.from('releases').update({ visibility }).eq('id', rel.id);
    if (error) setErr(error.message); else load();
  }
  async function unpublish() {
    if (!confirm('Take this project off Discover?')) return;
    const { error } = await sb.from('releases').delete().eq('id', rel.id);
    if (error) setErr(error.message); else load();
  }

  if (rel === undefined) return null;
  if (!isOwner) return rel ? <section className="m-card"><h3>Published on Discover</h3><p className="m-muted">{VIS_SHORT[rel.visibility]}</p></section> : null;
  if (!rel && project.status !== 'completed') {
    return <section className="m-card"><h3>Publish to Discover</h3><p className="m-muted">Mark this project as completed to share finished tracks on Discover, publicly or with friends only.</p></section>;
  }
  return (
    <section className="m-card">
      <h3>{rel ? 'Published on Discover' : 'Publish to Discover'}</h3>
      {err && <p role="alert" className="m-error">{err}</p>}
      {rel ? (<>
        <p className="m-muted">“{rel.title}” · published {timeAgo(rel.published_at)} · <Link className="m-link" href="/discover?tab=releases">See on Discover</Link></p>
        <VisibilitySelect value={rel.visibility} onChange={setVis} label="Who can listen?" />
        <div className="m-actions"><button className="m-btn m-btn--ghost" onClick={() => setOpen(true)}>Edit details and tracks</button><button className="m-btn m-btn--ghost" onClick={unpublish}>Unpublish</button></div>
      </>) : media.length === 0 ? (
        <p className="m-muted">Upload audio or video files in the Files tab first, then come back to publish them.</p>
      ) : (<>
        <p className="m-muted">Let people hear what you made together. Choose the tracks to feature and who can listen.</p>
        <div className="m-actions"><button className="m-btn m-btn--primary" onClick={() => setOpen(true)}>Publish</button></div>
      </>)}
      {open && <PublishDialog project={project} media={media} genres={genres} rel={rel} onClose={() => setOpen(false)} onDone={load} />}
    </section>
  );
}
