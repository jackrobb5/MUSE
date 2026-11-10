'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar } from './ui';
import MusicEmbed from './MusicEmbed';
import RequestDialog from './RequestDialog';
import { AVAILABILITY, EXPERIENCE } from '@/lib/labels';

export default function ArtistCard({ a, layout = 'grid', onDismiss }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [saved, setSaved] = useState(a.is_favourite);
  const [preview, setPreview] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const track = Array.isArray(a.portfolio_links) ? a.portfolio_links[0] : null;
  const where = [a.city, a.country].filter(Boolean).join(', ');

  async function message() {
    const { data, error } = await sb.rpc('start_conversation', { p_other: a.id });
    if (error) return setMsg(error.message);
    router.push(`/messages?c=${data}`);
  }
  async function toggleSave() {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = saved
      ? await sb.from('favourites').delete().match({ user_id: user.id, artist_id: a.id })
      : await sb.from('favourites').insert({ user_id: user.id, artist_id: a.id });
    if (error) setMsg(error.message); else setSaved(!saved);
  }
  async function dismiss() {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('dismissed_recommendations').upsert({ user_id: user.id, artist_id: a.id });
    if (error) setMsg(error.message); else onDismiss?.(a.id);
  }

  return (
    <article className={`m-card m-artist m-artist--${layout}`}>
      <Link href={`/profile/${a.username}`} className="m-artist__head">
        <Avatar url={a.avatar_url} name={a.display_name} size={layout === 'list' ? 56 : 72} />
        <div>
          <h3>{a.display_name}</h3>
          <p className="m-muted">@{a.username}{where && ` · ${where}`}</p>
        </div>
      </Link>
      {typeof a.score === 'number' && a.score > 0 && (
        <span className="m-score" title={(a.reasons || []).join('. ')} aria-label={`${a.score} percent match. ${(a.reasons || []).join('. ')}`}>{a.score}% match</span>
      )}
      {a.biography && <p className="m-clamp">{a.biography}</p>}
      <div className="m-chips">
        {(a.roles || []).slice(0, 3).map((r) => <span className="m-chip m-chip--role" key={r}>{r}</span>)}
        {(a.genres || []).slice(0, 3).map((g) => <span className="m-chip" key={g}>{g}</span>)}
      </div>
      <p className="m-muted">
        {a.seeking_collaborators ? 'Seeking collaborators' : 'Not currently seeking'}
        {a.availability && ` · ${AVAILABILITY[a.availability]}`}{a.experience_level && ` · ${EXPERIENCE[a.experience_level]}`}
      </p>
      {track && (preview
        ? <MusicEmbed url={track.url} title={track.title} />
        : <button className="m-btn m-btn--ghost" onClick={() => setPreview(true)}>Play preview{track.title ? `: ${track.title}` : ''}</button>)}
      <div className="m-actions">
        <Link className="m-btn m-btn--ghost" href={`/profile/${a.username}`}>View profile</Link>
        <button className="m-btn m-btn--primary" onClick={() => setOpen(true)}>Request</button>
        <button className="m-btn m-btn--ghost" onClick={message}>Message</button>
        <button className="m-btn m-btn--ghost" aria-pressed={saved} onClick={toggleSave}>{saved ? 'Saved' : 'Save'}</button>
        {onDismiss && <button className="m-btn m-btn--ghost" onClick={dismiss} title="Don’t recommend this artist again">Not for me</button>}
      </div>
      {msg && <p role="alert" className="m-error">{msg}</p>}
      {open && <RequestDialog recipientId={a.id} recipientName={a.display_name} onClose={() => setOpen(false)} onSent={() => setMsg('Request sent.')} />}
    </article>
  );
}
