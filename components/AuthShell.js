export default function AuthShell({ title, children }) {
  return (
    <main className="m-auth">
      <div className="m-auth__card">
        <p className="m-logo">MUSE</p>
        <p className="m-muted">Find your sound. Find your people. Make something together.</p>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
