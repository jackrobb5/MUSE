import Link from 'next/link';
import { Avatar } from './ui';
import { COMP, WORK, EXPERIENCE_REQ } from '@/lib/labels';
import { timeAgo } from '@/lib/format';

export default function CollabCard({ c }) {
  return (
    <article className="m-card m-collab">
      <div className="m-collab__top">
        <Link href={`/collaborations/${c.id}`}><h3>{c.title}</h3></Link>
        {c.status === 'closed' && <span className="m-chip">Closed</span>}
      </div>
      <p className="m-clamp">{c.description}</p>
      <div className="m-chips">
        {(c.collaboration_roles || []).map((r) => <span className="m-chip m-chip--role" key={r.musical_roles?.name}>{r.musical_roles?.name}</span>)}
        {c.genres?.name && <span className="m-chip">{c.genres.name}</span>}
        <span className="m-chip">{COMP[c.compensation_type]}</span>
        <span className="m-chip">{WORK[c.work_pref]}</span>
        <span className="m-chip">{EXPERIENCE_REQ[c.experience_level]}</span>
      </div>
      <p className="m-muted m-collab__by">
        <Avatar url={c.creator?.avatar_url} name={c.creator?.display_name} size={24} />
        <Link href={`/profile/${c.creator?.username}`}>{c.creator?.display_name}</Link> · {c.location || 'Worldwide'} · {timeAgo(c.created_at)}
      </p>
    </article>
  );
}
