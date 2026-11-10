# MUSE: Find your sound. Find your people. Make something together.

Global music collaboration platform. Next.js + Supabase + Vercel.

**Start here: `SETUP.md`** (create Supabase project, paste `supabase/ALL_IN_ONE.sql`, set `.env.local`, run, deploy).

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys
npm run dev
```

- Architecture: `docs/ARCHITECTURE.md`
- Design system: `docs/DESIGN_SYSTEM.md` (live reference at `/design` in development)
- Database + security rules: `supabase/`
- Tests: `npm test` (unit), `supabase/tests/rls_tests.sql` (security)
