'use client';
import Link from 'next/link';
import { Avatar } from './ui';
import MediaPlayer from './MediaPlayer';
import SafetyMenu from './SafetyMenu';
import { timeAgo } from '@/lib/format';

export default function SampleCard({ s }) {
  return (
    <article className="m-card m-sample">
      <div className="m-collab__top"><h3>{s.title}</h3>{s.visibility === 'friends' && <span className="m-chip">Friends only</span>}</div>
      <p className="m-collab__by">
        <Avatar url={s.owner?.avatar_url} name={s.owner?.display_name} size={28} />
        <Link href={`/profile/${s.owner?.username}`}>{s.owner?.display_name}</Link>
        <span className="m-muted">· {s.genres?.name ? `${s.genres.name} · ` : ''}{timeAgo(s.created_at)}</span>
      </p>
      {s.description && <p className="m-clamp">{s.description}</p>}
      <MediaPlayer bucket="samples" path={s.file_path} mime={s.mime_type} label={s.title} />
      <div className="m-actions"><SafetyMenu targetType="sample" targetId={s.id} /></div>
    </article>
  );
}
