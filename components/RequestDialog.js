'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import { isSafeHttpUrl } from '@/lib/embed';
import { WORK } from '@/lib/labels';

export default function RequestDialog({ recipientId, recipientName, collaboration, onClose, onSent }) {
  const { roles, genres } = useTaxonomy();
  const ref = useRef(null);
  const [f, setF] = useState({ description: '', role_id: '', genre_id: '', work_pref: 'remote', music_link: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (f.description.trim().length < 10) return setErr('Describe the project in at least 10 characters.');
    if (f.music_link && !isSafeHttpUrl(f.music_link)) return setErr('The music reference must be a valid http(s) link.');
    setBusy(true);
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('collaboration_requests').insert({
      sender_id: user.id, recipient_id: recipientId, collaboration_id: collaboration?.id ?? null,
      description: f.description.trim(), role_id: f.role_id ? Number(f.role_id) : null, genre_id: f.genre_id ? Number(f.genre_id) : null,
      work_pref: f.work_pref, music_link: f.music_link.trim() || null, message: f.message.trim() || null,
    });
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'You already have a pending request here.' : error.message);
    onSent?.();
    onClose();
  }

  return (
    <dialog ref={ref} className="m-dialog" onClose={onClose} aria-labelledby="req-title">
      <form onSubmit={submit} className="m-form">
        <h2 id="req-title">{collaboration ? `Apply to “${collaboration.title}”` : `Request a collaboration with ${recipientName}`}</h2>
        <label className="m-field">What are you making? *<textarea required maxLength={2000} rows={4} value={f.description} onChange={set('description')} /></label>
        <div className="m-row">
          <label className="m-field">Role needed<select value={f.role_id} onChange={set('role_id')}><option value="">Any</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="m-field">Genre<select value={f.genre_id} onChange={set('genre_id')}><option value="">Any</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="m-field">Working arrangement<select value={f.work_pref} onChange={set('work_pref')}>{Object.entries(WORK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <label className="m-field">Music reference (Spotify, SoundCloud, YouTube, Apple Music link)<input type="url" value={f.music_link} onChange={set('music_link')} placeholder="https://" /></label>
        <label className="m-field">Message<textarea maxLength={2000} rows={3} value={f.message} onChange={set('message')} /></label>
        {err && <p role="alert" className="m-error">{err}</p>}
        <div className="m-actions">
          <button type="button" className="m-btn m-btn--ghost" onClick={() => ref.current?.close()}>Cancel</button>
          <button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
        </div>
      </form>
    </dialog>
  );
}
