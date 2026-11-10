'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import ChipSelect from './ChipSelect';
import { CopyrightNotice, State } from './ui';
import { COMP, WORK, EXPERIENCE_REQ } from '@/lib/labels';

const BLANK = { title: '', description: '', genre_id: '', location: 'Worldwide', work_pref: 'remote', compensation_type: 'open', experience_level: 'all', role_ids: [] };

export default function CollabForm({ id }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const { roles, genres } = useTaxonomy();
  const [f, setF] = useState(id ? null : BLANK);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    sb.from('collaborations').select('*, collaboration_roles(role_id)').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) return setErr(error?.message || 'Listing not found.');
      setF({ ...data, genre_id: data.genre_id ?? '', location: data.location || '', role_ids: data.collaboration_roles.map((r) => r.role_id) });
    });
  }, [id]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (f.title.trim().length < 3) return setErr('Give your listing a title (at least 3 characters).');
    if (!f.description.trim()) return setErr('Describe what you’re making and who you need.');
    if (f.role_ids.length === 0) return setErr('Choose at least one role you’re looking for.');
    setBusy(true);
    const { data: { user } } = await sb.auth.getUser();
    const row = { title: f.title.trim(), description: f.description.trim(), genre_id: f.genre_id ? Number(f.genre_id) : null, location: f.location.trim() || null,
      work_pref: f.work_pref, compensation_type: f.compensation_type, experience_level: f.experience_level };
    let cid = id;
    if (id) {
      const { error } = await sb.from('collaborations').update(row).eq('id', id);
      if (error) { setBusy(false); return setErr(error.message); }
    } else {
      const { data, error } = await sb.from('collaborations').insert({ ...row, creator_id: user.id }).select('id').single();
      if (error) { setBusy(false); return setErr(error.message); }
      cid = data.id;
    }
    await sb.from('collaboration_roles').delete().eq('collaboration_id', cid);
    const { error: re } = await sb.from('collaboration_roles').insert(f.role_ids.map((role_id) => ({ collaboration_id: cid, role_id })));
    setBusy(false);
    if (re) return setErr(re.message);
    router.push(`/collaborations/${cid}`);
  }

  return (
    <State loading={!f && !err} error={!f ? err : ''}>
      {f && (
        <form className="m-form m-card" onSubmit={submit}>
          <label className="m-field">Title *<input value={f.title} onChange={set('title')} maxLength={120} placeholder="Looking for an R&B vocalist" required /></label>
          <label className="m-field">Description *<textarea rows={6} value={f.description} onChange={set('description')} maxLength={4000} required /></label>
          <ChipSelect label="Looking for *" options={roles} value={f.role_ids} onChange={(v) => setF({ ...f, role_ids: v })} max={10} />
          <div className="m-row">
            <label className="m-field">Genre<select value={f.genre_id} onChange={set('genre_id')}><option value="">Any</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label className="m-field">Location<input value={f.location} onChange={set('location')} maxLength={120} /></label>
            <label className="m-field">Working arrangement<select value={f.work_pref} onChange={set('work_pref')}>{Object.entries(WORK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className="m-row">
            <label className="m-field">Compensation<select value={f.compensation_type} onChange={set('compensation_type')}>{Object.entries(COMP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="m-field">Experience<select value={f.experience_level} onChange={set('experience_level')}>{Object.entries(EXPERIENCE_REQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <CopyrightNotice />
          {err && <p role="alert" className="m-error">{err}</p>}
          <div className="m-actions">
            <button type="button" className="m-btn m-btn--ghost" onClick={() => router.back()}>Cancel</button>
            <button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish listing'}</button>
          </div>
        </form>
      )}
    </State>
  );
}
