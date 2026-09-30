# Phase 4 — Supabase Auth & Student Ownership

## What changed
- Server validates Supabase access tokens with `/auth/v1/user`.
- Production mode requires `Authorization: Bearer <access_token>` for tutor, knowledge, and student APIs.
- Student access is checked against `students.auth_user_id` or the student's parent `parents.auth_user_id`.
- Service-role requests are still ownership-checked in application code because service-role bypasses RLS.
- RLS policies are included for direct Supabase reads.
- Client API calls automatically forward the access token when `athmik_supabase_access_token_v1` is present.

## Required database migration
Run `src/db/schema.sql` in the Supabase SQL editor. It adds `auth_user_id` ownership columns and policies.

## Required account linking
After creating a Supabase Auth user, set that user's UUID into the matching `parents.auth_user_id` row. For student-owned accounts, set `students.auth_user_id` instead.

## Deployment behavior
- If Supabase is configured, `SUPABASE_AUTH_REQUIRED=true` is the safe default.
- For local/demo-only mode, set `SUPABASE_AUTH_REQUIRED=false` and do not expose the app publicly.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in Vite/client environment variables.

## Verification checklist
1. Unauthenticated request to `/api/student/<id>/profile` returns 401 in production mode.
2. Valid parent token can access only that parent's student(s).
3. A token belonging to another parent receives 403.
4. Tutor chat with another student's ID receives 403.
5. Health endpoint remains public.
6. Client requests include the Bearer token automatically when stored.
