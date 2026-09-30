# Athmik AI Tutor — Architecture Hardening Audit

## Scope
Internal hardening only. No new user-facing features were added.

## Changes applied

1. **Tutor request validation**
   - Requires real student and subject IDs for `/api/tutor/chat`.
   - Validates tutor mode, conversation length, topic length, and identifier format.
   - Removed the previous hard-coded student/subject/chapter fallback IDs from the tutor request path.

2. **Server-owned adaptive difficulty**
   - Tutor difficulty is now resolved from server-side topic mastery instead of trusting the client-supplied difficulty level.

3. **Answer-cycle integrity**
   - Added a persisted active-question record per student.
   - A user message is evaluated as an answer only when it directly follows the server-tracked active tutor question.
   - Prevents ordinary follow-up messages from being accidentally scored as answers.

4. **Learning-memory persistence safety**
   - Learning-memory JSON writes now use temp-file + atomic rename semantics.
   - Write failures are surfaced instead of being silently swallowed.

5. **Mistake-resolution integrity**
   - Correct answers now resolve mistakes only when the chapter **and topic** match the unresolved mistake.

6. **Daily-plan integrity**
   - Removed hard-coded Mathematics / The Fish Tale plan entries.
   - Plan metadata is derived from the existing curriculum seed and the student's actual learning memory.
   - A student with no history starts from the first chapter of a configured priority subject rather than a hard-coded chapter.

7. **API hardening**
   - Reduced JSON request body limit from 50 MB to 10 MB.
   - Added lightweight per-student tutor request throttling.
   - Added student-ID validation middleware for Module 4 endpoints.
   - Added strict validation for manually recorded attempts and parent settings.

## Not silently changed

- Supabase is **not** introduced automatically because the uploaded project does not currently contain a configured Supabase runtime connection. Introducing it would be a backend migration, not merely an audit/hardening change.
- Authentication/RLS therefore remains a production prerequisite.
- The deterministic evaluator remains intentionally limited; replacing it with a generic grading engine would be a larger behavioral change.
- The existing browser local cache remains for compatibility; it is not promoted to the authoritative learning-memory store.

## Verification limitation

Dependency installation in this environment timed out, so a full TypeScript/build test could not be completed here. Static balance checks passed for the modified TypeScript files. The project should be run with its normal dependency installation before deployment.

## Phase 2 — Durable Data Architecture Prepared (30 Sep 2026)

A Supabase production migration has been added under `supabase/migrations/20260930_production_memory.sql`.

It establishes normalized tables for topic mastery, attempts, tutor questions, mistakes, sessions, and daily activity; adds pgvector storage for knowledge chunks; binds parent/student records to Supabase Auth identities; and adds RLS policies for student-owned learning data.

The application runtime is intentionally not switched over automatically yet. A verified backfill is required before removing JSON/localStorage as the source of truth.

## Phase 3 — Runtime Integration (30 Sep 2026)

Implemented:
- Native-fetch Supabase PostgREST client; no browser dependency and no service-role key exposure.
- Supabase hydration of profile, topic mastery, mistakes and active tutor question before tutor/API calculations when credentials are configured.
- Durable synchronization of attempts, mastery, mistakes, profiles, active question state and learning sessions.
- Stable `legacy_id` mapping so existing application IDs such as `sub_maths` and `chap_math_1` can coexist with Supabase UUID primary keys.
- `student_learning_profiles` durable table.
- Idempotent migration script: `npm run migrate:supabase`.
- Runtime deployment documentation in `supabase/PHASE3_RUNTIME.md`.

Not yet production-complete:
- Express request authentication/JWT verification is still required.
- Live Supabase credentials were not available in this workspace, so the migration was not executed against a real project.
- Full dependency install/build could not be completed in this environment because package installation timed out; therefore no claim of a clean production build is made.

## Phase 4 — Authentication & Ownership Hardening
- Added server-side Supabase access-token validation.
- Added parent/student auth ownership mapping via `auth_user_id`.
- Added backend authorization checks for every student-scoped API.
- Added auth protection for tutor and knowledge APIs when Supabase is configured.
- Added client token forwarding without exposing the service-role key.
- Added RLS ownership policies for direct Supabase reads.
- Preserved explicit local/demo mode only when `SUPABASE_AUTH_REQUIRED=false`.


## Phase 9 Production Readiness
- Fixed four Express handlers that used `await` without `async`, which would fail TypeScript compilation.
- Knowledge-base upload/delete are now operator-only via `KNOWLEDGE_ADMIN_USER_IDS`; ordinary authenticated users remain read/search capable.
- RAG migration was made idempotent across Phase 5/7 schema creation by explicitly adding missing runtime columns.
- PostgreSQL UUID generation now explicitly uses `pgcrypto`/`gen_random_uuid()` rather than relying on an undeclared UUID extension.
