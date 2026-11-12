'use client';
import Link from 'next/link';
import { Avatar } from './ui';
import MediaPlayer from './MediaPlayer';
import SafetyMenu from './SafetyMenu';
import { timeAgo } from '@/lib/format';

export default function ReleaseCard({ r }) {
  const tracks = [...(r.release_tracks || [])].sort((a, b) => a.position - b.position);
  const credits = r.release_credits || [];
  return (
    <article className="m-card m-release">
      <div className="m-collab__top"><h3>{r.title}</h3>{r.visibility === 'friends' && <span className="m-chip">Friends only</span>}</div>
      <p className="m-collab__by">
        <Avatar url={r.owner?.avatar_url} name={r.owner?.display_name} size={28} />
        <Link href={`/profile/${r.owner?.username}`}>{r.owner?.display_name}</Link>
        <span className="m-muted">· {r.genres?.name ? `${r.genres.name} · ` : ''}{timeAgo(r.published_at)}</span>
      </p>
      {r.description && <p className="m-clamp">{r.description}</p>}
      {credits.length > 0 && (
        <p className="m-muted">Made by: {credits.map((c, i) => (
          <span key={c.user_id}>{i > 0 && ', '}<Link className="m-link" href={`/profile/${c.profile?.username}`}>{c.profile?.display_name}</Link> ({c.role})</span>))}
        </p>)}
      <div className="m-tracklist">{tracks.map((t) => <MediaPlayer key={t.id} bucket="project-files" path={t.path} mime={t.mime_type} label={t.name} />)}</div>
      <div className="m-actions"><SafetyMenu targetType="release" targetId={r.id} /></div>
    </article>
  );
}
