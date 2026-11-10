# MUSE: complete setup guide (Supabase + Vercel)

This package contains the whole app: auth, onboarding, app shell, dashboard, profiles, discovery, collaborations, messaging, projects, notifications, settings, admin, security rules and tests.

**Honest status:** the code was written and statically checked (imports resolve, the music-link logic passes its checks in Node) but it has **not been run against a real Supabase project or built with `next build`**. Expect to fix small things on first run. Section 9 tells you how to find and fix them.

---

## 0. What you need
- Node.js 20+ (`node -v`), a code editor, a GitHub account, a free Supabase account, a free Vercel account.
- For Google sign-in (optional): a Google Cloud account.

## 1. Put the files in a project
```bash
unzip muse-complete.zip && cd muse-complete
npm install
```
Already have a Next.js project from steps 1 to 3? Copy these folders/files over it (the ones here replace same-named ones): `app/`, `components/`, `lib/`, `middleware.js`, `next.config.js` (merge), `jsconfig.json`, `supabase/`, `tests/`.

## 2. Create the Supabase project
1. supabase.com > **New project**. Pick a name, a strong database password (save it), and the region closest to your users.
2. Wait about 2 minutes until it finishes provisioning.
3. Open **Project Settings > API**. Copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key
   - **service_role** key (secret; it bypasses all security)

## 3. Add the keys to the app
```bash
cp .env.example .env.local
```
Edit `.env.local` and paste the three values. Never commit this file (`.gitignore` already excludes it). Restart `npm run dev` after any change to it.

## 4. Create the database (one paste)
1. Supabase dashboard > **SQL Editor > New query**.
2. Open `supabase/ALL_IN_ONE.sql` from this package, copy everything, paste, click **Run**. You should see "Success. No rows returned."
   - It creates all tables, indexes, security rules (Row Level Security), triggers, search/matching/messaging functions, storage buckets (`avatars`, `covers`) and realtime, then the signup trigger.
   - It is safe to run again. If it errors, read the message, fix the cause, and re-run the whole file.
   - If it complains about a type mismatch on `role_id`/`genre_id`, you have older tables with non-integer ids from earlier work: change `int` to `bigint` for those columns in the file and re-run.
3. Verify in **Table Editor**: you should see `profiles`, `artist_profiles`, `musical_roles` (16 rows), `genres` (18 rows), `collaborations`, `messages`, `projects`, `notifications`, `reports`, `blocks` and others.
4. Verify **Storage**: buckets `avatars` and `covers` exist.
5. Verify **Database > Publications > supabase_realtime**: `messages` and `notifications` are listed.

*(CLI alternative: `npm i -g supabase`, `supabase login`, `supabase link --project-ref YOUR_REF`, then `supabase db push` using the two files in `supabase/migrations/`.)*

## 5. Configure Authentication
In **Authentication**:
1. **URL Configuration:** Site URL = `http://localhost:3000`. Redirect URLs: add `http://localhost:3000/auth/callback`. (You'll add your live URL in section 8.)
2. **Providers > Email:** for local testing switch **Confirm email OFF** so you can sign up instantly. Switch it **ON** before real users.
3. **Password rules** (Authentication > Policies or Providers > Email): minimum length 8 or more; enable leaked-password protection if your plan offers it.
4. **Emails:** Supabase's built-in email sender is limited to a few emails an hour. Before launch, add your own SMTP (Project Settings > Auth > SMTP; Resend, Postmark or Brevo all work), otherwise confirmation and reset emails will be throttled.
5. **Google (optional):**
   - Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID > Web application.
   - Authorised redirect URI: `https://YOUR-REF.supabase.co/auth/v1/callback`.
   - Copy the Client ID and Secret into Supabase > Authentication > Providers > Google, and enable it.
   - Until you do this, the Google button shows an error and email login still works.

## 6. Run it locally
```bash
npm run dev
```
Open http://localhost:3000. Signed-out visitors see the landing page at `/welcome`; the style guide is at `/design` (development only).

**Test the whole journey** (use two browsers or one normal + one private window, with two accounts, "Anna" and "Ben"):
1. Sign up as Anna > complete onboarding (pick roles, genres, add a Spotify link) > you land on the dashboard.
2. In Supabase Table Editor > `profiles`: Anna's row has her chosen username and `onboarded = true`.
3. Sign up as Ben, onboard with a different role.
4. As Anna: Discover > find Ben > Message him. As Ben: reply, and watch it arrive live for Anna.
5. As Anna: Collaborations > Create listing. As Ben: open it > Apply. Anna: Collaborations > Requests > Accept > Start a project.
6. Post a project update; check Ben's notification bell.
7. Report a profile, block a user, export your data and delete a test account from Settings.

## 7. Make yourself admin, then run the tests
1. In the SQL Editor (replace the username): `update public.profiles set is_admin = true where username = 'your_username';`
2. Refresh the app: **Admin** now appears in the sidebar (`/admin`).
3. Unit test: `npm test`.
4. Security test: needs a database you can wipe, so use local Supabase (`supabase start`, `supabase db reset`) and run `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls_tests.sql`. You must see `ALL RLS TESTS PASSED`. Do **not** run it against your live project unless you accept it creates and rolls back test users in a transaction.

## 8. Deploy to Vercel
1. `git init && git add . && git commit -m "MUSE"`, create a GitHub repo, push.
2. vercel.com > **Add New > Project** > import the repo. Framework: Next.js (auto-detected).
3. Before deploying, add **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (do not tick any option that exposes it publicly). Deploy.
4. Copy your live URL (e.g. `https://muse.vercel.app`). In Supabase > Authentication > URL Configuration: set **Site URL** to it and add `https://muse.vercel.app/auth/callback` to Redirect URLs. For Google, no change is needed (it redirects via Supabase).
5. Test sign-up, email confirmation, login and password reset on the live site.
6. Custom domain: Vercel > Domains, then update the Site URL and Redirect URLs again.

## 9. If something breaks
| Symptom | Fix |
|---|---|
| Blank page / "Invalid API key" | `.env.local` values wrong or dev server not restarted. |
| Redirect loop on login | A URL is missing from Supabase Redirect URLs, or cookies are blocked. |
| "relation ... does not exist" | The SQL didn't run fully. Re-run `ALL_IN_ONE.sql`. |
| Lists empty / "permission denied" | Not logged in, or you skipped the SQL (security rules live there). |
| Signup works but no profile row | The `on_auth_user_created` trigger is missing; re-run the SQL (onboarding also self-heals this). |
| "Could not find a relationship between…" | A column/foreign-key name differs from the SQL; compare with `0001_muse_core.sql`. |
| Messages only appear after refresh | `messages` not in the realtime publication (section 4, step 5). |
| Music player blank | Console shows a Content-Security-Policy block or the link isn't a supported provider. |
| Build error mentioning `middleware` | Newer Next versions rename it `proxy.js`; rename the file and the exported function to `proxy`. |
| Next warns about `useSearchParams` | Not used here; it means you added it somewhere without a Suspense boundary. |

For anything else: browser DevTools > Console and Network tabs, and Supabase > Logs > API / Postgres, show the exact failing request and error.

## 10. Before real users (checklist)
- [ ] Email confirmation ON and custom SMTP configured
- [ ] Replace `/terms` and `/privacy` placeholders with lawyer-reviewed text (UK GDPR)
- [ ] Supabase backups enabled (paid plans) or a scheduled export
- [ ] CAPTCHA and auth rate limits (Supabase > Authentication > Rate limits / Attack protection)
- [ ] Tighten the CSP in `next.config.js` (nonces) when convenient
- [ ] Add ownership transfer before account deletion removes shared projects
- [ ] Test on a real phone and with keyboard-only navigation

## Known gaps (not built)
File attachments in messages, email/push notifications, follows/feed, invitation accept step for projects, Stripe, IP-level rate limiting, strict server-side hiding of city (it is hidden in the UI and discovery, but signed-in users can read `profiles.city` through the API).

## File map
- `supabase/ALL_IN_ONE.sql`: everything for the database (same as the two files in `migrations/`)
- `supabase/tests/rls_tests.sql`: security tests
- `middleware.js`: session refresh and route protection
- `app/(auth)/*`, `app/auth/callback`: login, signup, reset, email/Google callback
- `app/onboarding`: 3-step onboarding with progress bar
- `app/(app)/layout.js` + `components/AppNav.js`: sidebar / bottom nav shell, onboarding gate
- `app/(app)/page.js`: home dashboard
- `app/(app)/profile`, `discover`, `collaborations`, `messages`, `projects`, `notifications`, `settings`, `admin`
- `app/api/account/*`: data export and account deletion (server-side)
- `app/welcome`: public landing page; `app/design`: style guide (dev only); `app/tokens.css`: design tokens
- `docs/`: architecture and design-system documents
- `lib/` helpers, `components/` shared UI, `app/globals.css` + `app/muse-features.css` design system
