# Phase 3 — Supabase Runtime Integration

This phase makes Supabase the durable-memory source when server credentials are configured, while keeping the existing local files as a calculation/cache mirror during migration.

## Required server secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

The service-role key is server-only. Never expose it as a Vite `VITE_*` variable.

## Deployment order

1. Apply `supabase/schema.sql` to a new project if the project is empty.
2. Apply `supabase/migrations/20260930_production_memory.sql`.
3. Configure the three server secrets.
4. Run `npm run migrate:supabase` once against a backup of the existing data.
5. Verify student, topic mastery, mistakes, active question and profile counts.
6. Start the application with Supabase credentials. Tutor/profile/mastery/mistake flows hydrate from Supabase and writes are synchronized back to Supabase.
7. Keep the local JSON mirror during the verification window. Do not delete it until counts and sample records have been reconciled.

## What is now durable

- student learning profiles
- topic mastery
- learning attempts
- mistakes
- active tutor question state
- learning sessions

## Important limitation

Authentication is still not fully wired into the Express request boundary. Supabase RLS protects direct Supabase access, but the Express API currently trusts the student ID supplied by the client. Before public production deployment, add Supabase Auth JWT verification at the Express boundary and derive the student identity from the verified user/ownership relationship.

## Verification checklist

- Same student can restart the server without losing mastery.
- A second student cannot be hydrated from the first student's legacy ID.
- An active question survives a server restart.
- An attempt produces one durable `learning_attempts` row.
- Repeated synchronization updates the same topic mastery rather than creating duplicates.
- Mistake synchronization uses `legacy_id` for idempotency.
- Service-role key never appears in client bundles.
