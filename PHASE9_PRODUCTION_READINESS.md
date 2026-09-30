# Phase 9 — Production Readiness Audit

## Scope
Final architecture audit with no new user-facing features.

## Fixes applied
1. Corrected four Express handlers that contained `await` in non-async callbacks.
2. Added a privileged knowledge-admin gate for upload/delete operations.
3. Made the pgvector migration compatible with an already-created Phase 5 knowledge schema.
4. Explicitly enabled `pgcrypto` and switched UUID defaults to `gen_random_uuid()`.
5. Documented `KNOWLEDGE_ADMIN_USER_IDS` configuration.

## Remaining deployment gates
- Install dependencies and run `npm run lint`, `npm run build`, and `npm run test:integrity` in CI/staging.
- Apply both Supabase migrations to a disposable staging project.
- Configure Supabase Auth and map parent/student `auth_user_id` values.
- Configure `KNOWLEDGE_ADMIN_USER_IDS` before enabling knowledge administration.
- Run live authentication, ownership, RPC, pgvector, and migration/idempotency tests.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to the browser.

## Not claimed
No live production database or external API verification was performed in this environment.
