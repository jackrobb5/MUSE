import { notFound } from 'next/navigation';

export const metadata = { title: 'Design system · MUSE' };
const COLORS = [['bg', '#101014'], ['bg-2', '#181820'], ['card', '#20202A'], ['border', '#30303B'], ['accent', '#9875FF'], ['accent-2', '#C5A5FF'], ['text', '#FFFFFF'], ['text-muted', '#A5A5B5'], ['success', '#8de0a5'], ['warning', '#ffd479'], ['danger', '#ff8a8a']];

// Living style guide for developers and designers. Hidden in production.
export default function DesignSystem() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="m-page">
      <h1>MUSE design system</h1>
      <p className="m-muted">Tokens live in <code>app/tokens.css</code>. Component styles are in <code>app/globals.css</code> and <code>app/muse-features.css</code>.</p>
      <section className="m-card"><h2>Colour</h2>
        <div className="m-swatches">{COLORS.map(([n, c]) => <div key={n} className="m-swatch"><i style={{ background: c }} /><span>{n}<br />{c}</span></div>)}</div></section>
      <section className="m-card"><h2>Typography</h2>
        <h1>Heading 1: Find your sound</h1><h2>Heading 2: Find your people</h2><h3>Heading 3: Make something together</h3>
        <p>Body: the quick brown fox jumps over the lazy dog.</p><p className="m-muted">Muted: secondary information and metadata.</p></section>
      <section className="m-card"><h2>Buttons and chips</h2>
        <div className="m-actions"><button className="m-btn m-btn--primary">Primary</button><button className="m-btn">Default</button><button className="m-btn m-btn--ghost">Ghost</button><button className="m-btn m-btn--primary" disabled>Disabled</button></div>
        <div className="m-chips"><span className="m-chip">Genre</span><span className="m-chip m-chip--role">Role</span><span className="m-chip m-chip--pending">pending</span><span className="m-chip m-chip--accepted">accepted</span><span className="m-score">92% match</span></div></section>
      <section className="m-card"><h2>Form fields</h2>
        <div className="m-row"><label className="m-field">Text<input placeholder="Placeholder" /></label><label className="m-field">Select<select><option>Option</option></select></label></div>
        <label className="m-check"><input type="checkbox" defaultChecked /> Checkbox</label></section>
      <section className="m-card"><h2>States</h2>
        <div className="m-state" role="status"><span className="m-spinner" /> Loading…</div>
        <div className="m-state"><h3>Empty state</h3><p>Explain what belongs here and how to add it.</p></div>
        <div className="m-state m-state--error" role="alert">Error state message</div>
        <p className="m-notice">Notice: copyright and royalty terms are agreed between collaborators.</p></section>
    </main>
  );
}
