'use client';
export default function ErrorPage({ reset }) {
  return (<main className="m-page"><div className="m-state m-state--error" role="alert"><h2>Something went wrong</h2><p>Please try again.</p><button className="m-btn m-btn--primary" onClick={reset}>Try again</button></div></main>);
}
