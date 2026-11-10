import { initials } from '@/lib/format';

export function Avatar({ url, name, size = 48 }) {
  const style = { width: size, height: size };
  return url
    ? <img className="m-avatar" src={url} alt="" width={size} height={size} loading="lazy" decoding="async" style={style} />
    : <span className="m-avatar m-avatar--blank" aria-hidden="true" style={{ ...style, fontSize: size / 2.6 }}>{initials(name)}</span>;
}

// One place for loading / error / empty states so every screen behaves the same.
export function State({ loading, error, empty, emptyTitle, emptyText, action, children }) {
  if (loading) return (
    <div role="status" aria-live="polite">
      <span className="m-sr">Loading…</span>
      <div className="m-skel-grid" aria-hidden="true"><div className="m-skel" /><div className="m-skel" /><div className="m-skel" /></div>
    </div>
  );
  if (error) return <div className="m-state m-state--error" role="alert">{error}</div>;
  if (empty) return <div className="m-state"><h3>{emptyTitle}</h3><p>{emptyText}</p>{action}</div>;
  return children;
}

export function CopyrightNotice() {
  return (
    <p className="m-notice">
      MUSE doesn’t own, verify or enforce rights in your music. Copyright ownership, credits, royalty splits and payment are agreed
      between collaborators. Record what you agree here, and consider a written agreement or legal advice for anything important.
    </p>
  );
}
