'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import ChipSelect from '@/components/ChipSelect';
import { Avatar, State } from '@/components/ui';
import { isSafeHttpUrl } from '@/lib/embed';
import { confetti } from '@/lib/confetti';
import { AVAILABILITY, EXPERIENCE, WORK } from '@/lib/labels';

const STEPS = ['About you', 'Your music', 'Collaboration'];
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function Onboarding() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const { roles, genres } = useTaxonomy();
  const [uid, setUid] = useState(null);
  const [step, setStep] = useState(0);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return router.push('/login');
      setUid(user.id);
      let { data } = await sb.from('profiles').select('username,display_name,biography,country,city,avatar_url,onboarded,artist_profiles(*)').eq('id', user.id).maybeSingle();
      if (!data) { // safety net if the signup trigger didn't run
        await sb.from('profiles').insert({ id: user.id, username: `user_${user.id.replace(/-/g, '').slice(0, 12)}`, display_name: (user.email || 'New artist').split('@')[0] });
        ({ data } = await sb.from('profiles').select('username,display_name,biography,country,city,avatar_url,onboarded,artist_profiles(*)').eq('id', user.id).maybeSingle());
      }
      if (data?.onboarded) return router.push('/');
      const a = data?.artist_profiles || {};
      setF({
        username: data?.username?.startsWith('user_') ? '' : data?.username || '', display_name: data?.display_name || '', biography: data?.biography || '',
        country: data?.country || '', city: data?.city || '', avatar_url: data?.avatar_url || null,
        role_ids: [], primary_role: null, genre_ids: [], influences: (a.influences || []).join(', '), experience_level: a.experience_level || '',
        links: (a.portfolio_links?.length ? a.portfolio_links : [{ title: '', url: '' }]),
        looking_for_role_ids: a.looking_for_role_ids || [], work_pref: a.work_pref || 'both', availability: a.availability || 'available',
        seeking_collaborators: a.seeking_collaborators ?? true, open_paid: a.open_paid ?? false, open_royalty: a.open_royalty ?? true, open_unpaid: a.open_unpaid ?? true,
      });
    })();
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function upload(file) {
    if (!file) return;
    if (!TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) return setErr('Use a JPG, PNG or WebP image under 5 MB.');
    const path = `${uid}/${Date.now()}.${file.type.split('/')[1]}`;
    const { error } = await sb.storage.from('avatars').upload(path, file, { contentType: file.type });
    if (error) return setErr(error.message);
    setF((s) => ({ ...s, avatar_url: sb.storage.from('avatars').getPublicUrl(path).data.publicUrl }));
  }

  async function persist() {
    const username = f.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) { setErr('Choose a username: 3–30 characters, lowercase letters, numbers and underscores.'); return false; }
    if (!f.display_name.trim()) { setErr('Add a display name.'); return false; }
    const links = f.links.filter((l) => l.url.trim());
    if (links.some((l) => !isSafeHttpUrl(l.url))) { setErr('Music links must be valid http(s) URLs.'); return false; }
    const { error: e1 } = await sb.from('profiles').update({ username, display_name: f.display_name.trim(), biography: f.biography.trim() || null, country: f.country.trim() || null, city: f.city.trim() || null, avatar_url: f.avatar_url }).eq('id', uid);
    if (e1) { setErr(e1.code === '23505' ? 'That username is taken. Try another.' : e1.message); return false; }
    const { error: e2 } = await sb.from('artist_profiles').upsert({
      user_id: uid, experience_level: f.experience_level || null, availability: f.availability, seeking_collaborators: f.seeking_collaborators, work_pref: f.work_pref,
      open_paid: f.open_paid, open_royalty: f.open_royalty, open_unpaid: f.open_unpaid, looking_for_role_ids: f.looking_for_role_ids,
      influences: f.influences.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20), portfolio_links: links.map((l) => ({ title: l.title?.trim() || null, url: l.url.trim() })),
    });
    if (e2) { setErr(e2.message); return false; }
    const { error: e3 } = await sb.rpc('set_user_taxonomy', { p_roles: f.role_ids, p_primary: f.role_ids.includes(f.primary_role) ? f.primary_role : (f.role_ids[0] ?? null), p_genres: f.genre_ids });
    if (e3) { setErr(e3.message); return false; }
    return true;
  }

  async function next(skip = false) {
    setErr(''); setBusy(true);
    const ok = skip && step > 0 ? true : await persist();   // step 1 can't be skipped; later steps can
    if (ok && step === STEPS.length - 1) {
      const { error } = await sb.from('profiles').update({ onboarded: true }).eq('id', uid);
      if (error) { setBusy(false); return setErr(error.message); }
      confetti(); router.push('/'); router.refresh(); return;
    }
    setBusy(false);
    if (ok) setStep(step + 1);
  }
  const setLink = (i, k, v) => setF({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });

  return (
    <main className="m-auth m-auth--wide">
      <div className="m-auth__card">
        <p className="m-logo">MUSE</p>
        <p className="m-muted" id="progress-label">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        <progress value={step + 1} max={STEPS.length} aria-labelledby="progress-label" className="m-progress" />
        <State loading={!f} >
          {f && (
            <form className="m-form" onSubmit={(e) => { e.preventDefault(); next(false); }}>
              {step === 0 && (<>
                <h1>Tell us about you</h1>
                <div className="m-row"><Avatar url={f.avatar_url} name={f.display_name} size={72} /><label className="m-field">Profile photo (optional)<input type="file" accept={TYPES.join(',')} onChange={(e) => upload(e.target.files[0])} /></label></div>
                <div className="m-row">
                  <label className="m-field">Artist / display name *<input value={f.display_name} onChange={set('display_name')} maxLength={60} required /></label>
                  <label className="m-field">Username *<input value={f.username} onChange={set('username')} maxLength={30} autoCapitalize="none" placeholder="e.g. luna_beats" required /></label>
                </div>
                <div className="m-row">
                  <label className="m-field">Country<input value={f.country} onChange={set('country')} maxLength={60} /></label>
                  <label className="m-field">City or area<input value={f.city} onChange={set('city')} maxLength={60} /></label>
                </div>
                <label className="m-field">Short bio ({f.biography.length}/500)<textarea rows={3} maxLength={500} value={f.biography} onChange={set('biography')} /></label>
              </>)}
              {step === 1 && (<>
                <h1>Your music</h1>
                <ChipSelect label="What do you do? (choose all that apply)" options={roles} value={f.role_ids} onChange={(v) => setF({ ...f, role_ids: v })} max={20} />
                {f.role_ids.length > 1 && <label className="m-field">Primary role<select value={f.primary_role ?? f.role_ids[0]} onChange={(e) => setF({ ...f, primary_role: Number(e.target.value) })}>{roles.filter((r) => f.role_ids.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
                <ChipSelect label="Genres" options={genres} value={f.genre_ids} onChange={(v) => setF({ ...f, genre_ids: v })} max={20} />
                <label className="m-field">Influences (comma separated)<input value={f.influences} onChange={set('influences')} /></label>
                <label className="m-field">Experience<select value={f.experience_level} onChange={set('experience_level')}><option value="">Prefer not to say</option>{Object.entries(EXPERIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <fieldset className="m-field"><legend>Music links (Spotify, SoundCloud, YouTube, Apple Music)</legend>
                  {f.links.map((l, i) => (<div className="m-row" key={i}>
                    <input aria-label="Title" placeholder="Title" value={l.title || ''} onChange={(e) => setLink(i, 'title', e.target.value)} />
                    <input aria-label="URL" type="url" placeholder="https://" value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} /></div>))}
                  {f.links.length < 3 && <button type="button" className="m-btn m-btn--ghost" onClick={() => setF({ ...f, links: [...f.links, { title: '', url: '' }] })}>Add another</button>}
                </fieldset>
              </>)}
              {step === 2 && (<>
                <h1>Who do you want to work with?</h1>
                <ChipSelect label="Roles you’re looking for" options={roles} value={f.looking_for_role_ids} onChange={(v) => setF({ ...f, looking_for_role_ids: v })} max={20} />
                <div className="m-row">
                  <label className="m-field">Working arrangement<select value={f.work_pref} onChange={set('work_pref')}>{Object.entries(WORK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label className="m-field">Availability<select value={f.availability} onChange={set('availability')}>{Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                </div>
                <label className="m-check"><input type="checkbox" checked={f.seeking_collaborators} onChange={set('seeking_collaborators')} /> I’m actively seeking collaborators</label>
                <label className="m-check"><input type="checkbox" checked={f.open_paid} onChange={set('open_paid')} /> Open to paid projects</label>
                <label className="m-check"><input type="checkbox" checked={f.open_royalty} onChange={set('open_royalty')} /> Open to royalty splits</label>
                <label className="m-check"><input type="checkbox" checked={f.open_unpaid} onChange={set('open_unpaid')} /> Open to unpaid collaborations</label>
                <p className="m-notice">Royalties, credits and ownership are agreed between collaborators. MUSE doesn’t enforce them.</p>
              </>)}
              {err && <p role="alert" className="m-error">{err}</p>}
              <div className="m-actions">
                {step > 0 && <button type="button" className="m-btn m-btn--ghost" onClick={() => { setErr(''); setStep(step - 1); }}>Back</button>}
                {step > 0 && <button type="button" className="m-btn m-btn--ghost" disabled={busy} onClick={() => next(true)}>{step === STEPS.length - 1 ? 'Skip and finish' : 'Skip for now'}</button>}
                <button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Continue'}</button>
              </div>
            </form>
          )}
        </State>
      </div>
    </main>
  );
}
