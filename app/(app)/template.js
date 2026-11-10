// A template re-mounts on every navigation, which gives each screen a soft fade-in.
export default function Template({ children }) {
  return <div className="m-route">{children}</div>;
}
