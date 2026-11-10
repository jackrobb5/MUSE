# MUSE architecture (Step 1)

## Stack
| Layer | Choice | Why |
|---|---|---|
| UI | Next.js 15 (App Router), React 19, plain CSS with design tokens | Client-side navigation without full reloads, server components for secure data fetching, no CSS framework dependency |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) | One managed service covers database, login, file uploads and live messaging on a small budget |
| Hosting | Vercel | Zero-config Next.js deploys; environment variables for secrets |
| Payments | Stripe (Phase 2, not built) | Headers and env names are prepared; nothing is pretended to work |

## Folder structure
```
app/
  layout.js, tokens.css, globals.css, muse-features.css   root layout + design system
  welcome/            public landing page
  (auth)/             login, signup, forgot-password, reset-password
  auth/callback/      email / Google code exchange
  onboarding/         3-step onboarding
  (app)/              signed-in shell (sidebar / bottom nav) and all product screens
    page.js           home dashboard
    profile/ discover/ collaborations/ messages/ projects/ notifications/ settings/ admin/
  api/account/        server-only: data export, account deletion
  design/             style guide (development only)
components/           shared UI (nav, cards, dialogs, forms)
lib/                  Supabase clients, music-link allow-list, labels, helpers
middleware.js         session refresh + route protection
supabase/             migrations, ALL_IN_ONE.sql, security tests
tests/                unit tests
docs/                 this document and the design system guide
```

## Data flow
1. The browser talks to Supabase directly with the **anon key**. This is safe only because **Row Level Security** on every table decides what each signed-in user may read or write.
2. Anything that must bypass those rules (deleting an auth user) runs in a server route using the **service-role key**, which exists only in server environment variables.
3. Multi-step or trust-sensitive operations are **Postgres functions**: `discover_artists` (search + matching score), `start_conversation`, `respond_to_request`, `create_project_from_request`, `set_user_taxonomy`, `admin_stats`. Clients cannot skip their checks.
4. **Triggers** create notifications, enforce blocking, rate-limit spam and protect admin/suspension flags.
5. **Realtime** pushes new messages and notifications to the browser, filtered by the same security rules.

## Security model (summary)
- Authentication: Supabase Auth (email + password, Google when configured), middleware-protected routes.
- Authorisation: RLS everywhere; helper functions (`in_conversation`, `in_project`, `owns_collab`, `is_admin`) avoid recursive policies.
- Admin: `profiles.is_admin` can only be set by someone with database access; admin screens are additionally gated in the UI, but the database is the real enforcement.
- Uploads: image-only buckets with size limits, writable only to the owner's folder.
- Web: Content-Security-Policy restricting frames to four music providers, other standard security headers, same-origin check on account routes, link validation (`http(s)` only).
- Privacy: location hiding option, data export, account deletion, reporting and blocking.
- Legal: platform states that copyright, royalties and payment are agreed between collaborators; "agreed terms" are a record, not a contract.

## Extending (future phases)
- Phase 2: add `subscriptions` + Stripe webhook route; replace the rule-based score inside `discover_artists`; verified badge column on `profiles`.
- Phase 3: split sheets and payments tables referencing `projects`; file versioning in Storage.
- Phase 4: native apps reuse the same Supabase backend and RPC functions.
