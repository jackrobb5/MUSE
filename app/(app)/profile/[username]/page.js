import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { Avatar, CopyrightNotice } from '@/components/ui';
import MusicEmbed from '@/components/MusicEmbed';
import ProfileActions from '@/components/ProfileActions';
import ProfileMedia from '@/components/ProfileMedia';
import { isSafeHttpUrl } from '@/lib/embed';
import { AVAILABILITY, EXPERIENCE, WORK } from '@/lib/labels';

export async function generateMetadata({ params }) {
  const { username } = await params;
  return { title: `@${username} · MUSE` };
}

export default async function ProfilePage({ params }) {
  const { username } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const { data: p } = await sb.from('profiles')
    .select('id,username,display_name,avatar_url,cover_image_url,biography,country,city,show_city,created_at,artist_profiles(*),user_roles(is_primary,musical_roles(name)),user_genres(genres(name))')
    .eq('username', username.toLowerCase()).maybeSingle();
  if (!p) notFound();

  const isMe = user?.id === p.id;
  const [{ data: summary }, { data: fav }] = await Promise.all([
    sb.rpc('profile_summary', { p_user: p.id }),
    isMe ? { data: null } : sb.from('favourites').select('artist_id').eq('artist_id', p.id).maybeSingle(),
  ]);
  const a = p.artist_profiles || {};
  const roles = [...(p.user_roles || [])].sort((x, y) => Number(y.is_primary) - Number(x.is_primary)).map((r) => ({ name: r.musical_roles?.name, primary: r.is_primary }));
  const genres = (p.user_genres || []).map((g) => g.genres?.name).filter(Boolean);
  const where = [p.show_city || isMe ? p.city : null, p.country].filter(Boolean).join(', ');
  const portfolio = Array.isArray(a.portfolio_links) ? a.portfolio_links : [];
  const social = Object.entries(a.social_links || {}).filter(([, v]) => isSafeHttpUrl(v));
  const comp = [a.open_paid && 'Paid projects', a.open_royalty && 'Royalty splits', a.open_unpaid && 'Unpaid collaborations'].filter(Boolean);

  return (
    <main className="m-page m-profile">
      <div className="m-cover" style={p.cover_image_url ? { backgroundImage: `url(${p.cover_image_url})` } : undefined} role="img" aria-label="Cover image" />
      <header className="m-profile__head">
        <Avatar url={p.avatar_url} name={p.display_name} size={112} />
        <div>
          <h1>{p.display_name}</h1>
          <p className="m-muted">@{p.username}{where && ` · ${where}`}</p>
        </div>
        {isMe
          ? <div className="m-actions"><Link className="m-btn m-btn--primary" href="/profile/edit">Edit profile</Link><Link className="m-btn m-btn--ghost" href="/friends">Friends</Link><Link className="m-btn m-btn--ghost" href="/samples">My samples</Link></div>
          : <ProfileActions artistId={p.id} displayName={p.display_name} saved={!!fav} />}
      </header>

      <section className="m-card">
        {p.biography ? <p className="m-prewrap">{p.biography}</p> : <p className="m-muted">{isMe ? 'Add a short bio so people know what you make.' : 'No bio yet.'}</p>}
        <div className="m-chips">
          {roles.map((r) => <span key={r.name} className={`m-chip m-chip--role${r.primary ? ' is-primary' : ''}`}>{r.name}</span>)}
          {genres.map((g) => <span key={g} className="m-chip">{g}</span>)}
        </div>
        <dl className="m-facts">
          {a.experience_level && <><dt>Experience</dt><dd>{EXPERIENCE[a.experience_level]}</dd></>}
          {a.availability && <><dt>Availability</dt><dd>{AVAILABILITY[a.availability]}{a.seeking_collaborators ? ' · seeking collaborators' : ''}</dd></>}
          {a.work_pref && <><dt>Works</dt><dd>{WORK[a.work_pref]}</dd></>}
          {comp.length > 0 && <><dt>Open to</dt><dd>{comp.join(', ')}</dd></>}
          {a.influences?.length > 0 && <><dt>Influences</dt><dd>{a.influences.join(', ')}</dd></>}
        </dl>
        {social.length > 0 && (
          <p className="m-links">{social.map(([k, v]) => <a key={k} className="m-link" href={v} target="_blank" rel="noopener noreferrer nofollow ugc">{k}</a>)}</p>
        )}
      </section>

      <section id="music" className="m-card">
        <h2>Music</h2>
        {portfolio.length === 0
          ? <p className="m-muted">{isMe ? 'Add Spotify, SoundCloud, YouTube or Apple Music links in Edit profile.' : 'No music added yet.'}</p>
          : <div className="m-stack">{portfolio.map((l, i) => <MusicEmbed key={i} url={l.url} title={l.title} />)}</div>}
      </section>

      <ProfileMedia userId={p.id} isMe={isMe} />

      <section className="m-card">
        <h2>Activity</h2>
        <dl className="m-stats">
          <div><dt>Listings</dt><dd>{summary?.listings ?? 0}</dd></div>
          <div><dt>Accepted requests</dt><dd>{summary?.accepted_requests ?? 0}</dd></div>
          <div><dt>Completed projects</dt><dd>{summary?.completed_projects ?? 0}</dd></div>
        </dl>
        {summary?.history?.length > 0 && (
          <>
            <h3>Collaboration history</h3>
            <ul className="m-plain">{summary.history.map((h, i) => <li key={i}>{h.title} <span className="m-muted">· {h.role}</span></li>)}</ul>
          </>
        )}
      </section>
      <CopyrightNotice />
    </main>
  );
}
