'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import ChipSelect from '@/components/ChipSelect';
import { Avatar, State } from '@/components/ui';
import { isSafeHttpUrl, parseMusicLink } from '@/lib/embed';
import { AVAILABILITY, EXPERIENCE, WORK } from '@/lib/labels';

const MAX_LINKS = 8;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditProfile() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const { roles, genres } = useTaxonomy();
  const [uid, setUid] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return router.push('/login');
      setUid(user.id);
      const { data, error } = await sb.from('profiles')
        .select('username,display_name,biography,country,city,show_city,avatar_url,cover_image_url,artist_profiles(*),user_roles(role_id,is_primary),user_genres(genre_id)')
        .eq('id', user.id).maybeSingle();
      if (error) return setLoadErr(error.message);
      const a = data?.artist_profiles || {};
      setF({
        username: data?.username || '', display_name: data?.display_name || '', biography: data?.biography || '',
        country: data?.country || '', city: data?.city || '', show_city: data?.show_city ?? true,
        avatar_url: data?.avatar_url || null, cover_image_url: data?.cover_image_url || null,
        experience_level: a.experience_level || '', availability: a.availability || 'available',
        seeking_collaborators: a.seeking_collaborators ?? true, work_pref: a.work_pref || 'both',
        open_paid: a.open_paid ?? false, open_royalty: a.open_royalty ?? true, open_unpaid: a.open_unpaid ?? true,
        influences: (a.influences || []).join(', '), portfolio_links: a.portfolio_links || [],
        social: { instagram: '', x: '', website: '', ...(a.social_links || {}) },
        role_ids: (data?.user_roles || []).map((r) => r.role_id),
        primary_role: (data?.user_roles || []).find((r) => r.is_primary)?.role_id ?? null,
        genre_ids: (data?.user_genres || []).map((g) => g.genre_id),
        looking_for_role_ids: a.looking_for_role_ids || [],
      });
    })();
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const fail = (text) => setMsg({ type: 'error', text });

  async function upload(bucket, file) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return fail('Use a JPG, PNG or WebP image.');
    if (file.size > (bucket === 'avatars' ? 5 : 8) * 1024 * 1024) return fail(`That image is too large (max ${bucket === 'avatars' ? 5 : 8} MB).`);
    const path = `${uid}/${Date.now()}.${file.type.split('/')[1]}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) return fail(error.message);
    const url = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    setF((s) => ({ ...s, [bucket === 'avatars' ? 'avatar_url' : 'cover_image_url']: url }));
    setMsg({ type: 'info', text: 'Image uploaded. Save changes to apply it.' });
  }

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    const username = f.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) return fail('Username: 3–30 characters, lowercase letters, numbers and underscores.');
    if (!f.display_name.trim()) return fail('Add a display name.');
    if (f.biography.length > 500) return fail('Bio is limited to 500 characters.');
    const links = f.portfolio_links.filter((l) => l.url.trim());
    if (links.some((l) => !isSafeHttpUrl(l.url))) return fail('Every music link must be a valid http(s) URL.');
    const social = Object.fromEntries(Object.entries(f.social).filter(([, v]) => v.trim()));
    if (Object.values(social).some((v) => !isSafeHttpUrl(v))) return fail('Social links must be full http(s) URLs.');

    setBusy(true);
    const { error: e1 } = await sb.from('profiles').update({
      username, display_name: f.display_name.trim(), biography: f.biography.trim() || null,
      country: f.country.trim() || null, city: f.city.trim() || null, show_city: f.show_city,
      avatar_url: f.avatar_url, cover_image_url: f.cover_image_url,
    }).eq('id', uid);
    if (e1) { setBusy(false); return fail(e1.code === '23505' ? 'That username is taken.' : e1.message); }
    const { error: e2 } = await sb.from('artist_profiles').upsert({
      user_id: uid, experience_level: f.experience_level || null, availability: f.availability,
      seeking_collaborators: f.seeking_collaborators, work_pref: f.work_pref,
      open_paid: f.open_paid, open_royalty: f.open_royalty, open_unpaid: f.open_unpaid,
      influences: f.influences.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
      portfolio_links: links.map((l) => ({ title: l.title?.trim() || null, url: l.url.trim() })),
      social_links: social, looking_for_role_ids: f.looking_for_role_ids,
    });
    if (e2) { setBusy(false); return fail(e2.message); }
    const { error: e3 } = await sb.rpc('set_user_taxonomy', { p_roles: f.role_ids, p_primary: f.role_ids.includes(f.primary_role) ? f.primary_role : (f.role_ids[0] ?? null), p_genres: f.genre_ids });
    setBusy(false);
    if (e3) return fail(e3.message);
    router.push(`/profile/${username}`);
    router.refresh();
  }

  const setLink = (i, k, v) => setF({ ...f, portfolio_links: f.portfolio_links.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });

  return (
    <main className="m-page">
      <h1>Edit profile</h1>
      <State loading={!f && !loadErr} error={loadErr}>
        {f && (
          <form className="m-form" onSubmit={save} noValidate>
            <section className="m-card">
              <h2>Identity</h2>
              <div className="m-row">
                <Avatar url={f.avatar_url} name={f.display_name} size={72} />
                <label className="m-field">Profile photo<input type="file" accept={TYPES.join(',')} onChange={(e) => upload('avatars', e.target.files[0])} /></label>
                <label className="m-field">Cover image<input type="file" accept={TYPES.join(',')} onChange={(e) => upload('covers', e.target.files[0])} /></label>
              </div>
              <div className="m-row">
                <label className="m-field">Artist name<input value={f.display_name} onChange={set('display_name')} maxLength={60} required /></label>
                <label className="m-field">Username<input value={f.username} onChange={set('username')} maxLength={30} required autoCapitalize="none" /></label>
              </div>
              <label className="m-field">Bio ({f.biography.length}/500)<textarea rows={4} maxLength={500} value={f.biography} onChange={set('biography')} /></label>
              <div className="m-row">
                <label className="m-field">Country<input value={f.country} onChange={set('country')} maxLength={60} /></label>
                <label className="m-field">City / area<input value={f.city} onChange={set('city')} maxLength={60} /></label>
              </div>
              <label className="m-check"><input type="checkbox" checked={f.show_city} onChange={set('show_city')} /> Show my city on my profile and in discovery</label>
            </section>

            <section className="m-card">
              <h2>Music</h2>
              <ChipSelect label="Your musical roles" options={roles} value={f.role_ids} onChange={(v) => setF({ ...f, role_ids: v })} max={20} />
              {f.role_ids.length > 1 && (
                <label className="m-field">Primary role<select value={f.primary_role ?? ''} onChange={(e) => setF({ ...f, primary_role: Number(e.target.value) })}>
                  {roles.filter((r) => f.role_ids.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              )}
              <ChipSelect label="Genres" options={genres} value={f.genre_ids} onChange={(v) => setF({ ...f, genre_ids: v })} max={20} />
              <label className="m-field">Influences (comma separated)<input value={f.influences} onChange={set('influences')} /></label>
              <label className="m-field">Experience<select value={f.experience_level} onChange={set('experience_level')}><option value="">Prefer not to say</option>{Object.entries(EXPERIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <fieldset className="m-field"><legend>Music links (Spotify, SoundCloud, YouTube, Apple Music)</legend>
                {f.portfolio_links.map((l, i) => (
                  <div className="m-row" key={i}>
                    <input aria-label="Title" placeholder="Title" value={l.title || ''} onChange={(e) => setLink(i, 'title', e.target.value)} />
                    <input aria-label="URL" type="url" placeholder="https://" value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} />
                    <span className="m-muted">{l.url && (parseMusicLink(l.url)?.provider || (isSafeHttpUrl(l.url) ? 'Link only' : 'Invalid'))}</span>
                    <button type="button" className="m-btn m-btn--ghost" onClick={() => setF({ ...f, portfolio_links: f.portfolio_links.filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                ))}
                {f.portfolio_links.length < MAX_LINKS && <button type="button" className="m-btn m-btn--ghost" onClick={() => setF({ ...f, portfolio_links: [...f.portfolio_links, { title: '', url: '' }] })}>Add a link</button>}
              </fieldset>
              <div className="m-row">
                {['instagram', 'x', 'website'].map((k) => <label className="m-field" key={k}>{k === 'x' ? 'X' : k[0].toUpperCase() + k.slice(1)} URL<input type="url" value={f.social[k]} onChange={(e) => setF({ ...f, social: { ...f.social, [k]: e.target.value } })} /></label>)}
              </div>
            </section>

            <section className="m-card">
              <h2>Collaboration preferences</h2>
              <ChipSelect label="Roles you’re looking for" options={roles} value={f.looking_for_role_ids} onChange={(v) => setF({ ...f, looking_for_role_ids: v })} max={20} />
              <div className="m-row">
                <label className="m-field">Availability<select value={f.availability} onChange={set('availability')}>{Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className="m-field">Working arrangement<select value={f.work_pref} onChange={set('work_pref')}>{Object.entries(WORK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              </div>
              <label className="m-check"><input type="checkbox" checked={f.seeking_collaborators} onChange={set('seeking_collaborators')} /> I’m actively seeking collaborators</label>
              <label className="m-check"><input type="checkbox" checked={f.open_paid} onChange={set('open_paid')} /> Open to paid projects</label>
              <label className="m-check"><input type="checkbox" checked={f.open_royalty} onChange={set('open_royalty')} /> Open to royalty splits</label>
              <label className="m-check"><input type="checkbox" checked={f.open_unpaid} onChange={set('open_unpaid')} /> Open to unpaid collaborations</label>
            </section>

            {msg && <p role={msg.type === 'error' ? 'alert' : 'status'} className={msg.type === 'error' ? 'm-error' : 'm-muted'}>{msg.text}</p>}
            <div className="m-actions"><button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        )}
      </State>
    </main>
  );
}
