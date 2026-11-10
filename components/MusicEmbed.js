import { parseMusicLink, isSafeHttpUrl } from '@/lib/embed';

export default function MusicEmbed({ url, title }) {
  const e = parseMusicLink(url);
  if (e) {
    return (
      <iframe className="m-embed" src={e.embedUrl} height={e.height} loading="lazy" title={title || `${e.provider} player`}
        allow="encrypted-media; clipboard-write" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="strict-origin-when-cross-origin" />
    );
  }
  if (isSafeHttpUrl(url)) return <a className="m-link" href={url} target="_blank" rel="noopener noreferrer nofollow ugc">{title || url}</a>;
  return <span>{title || 'Invalid link'}</span>;
}
