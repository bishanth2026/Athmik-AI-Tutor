# Phase 5 — Durable Learning Storage Authority

## Goal
Supabase is the persistence authority for learning memory. Browser localStorage is cache/UI state only and is never promoted to authority after a server failure.

## Changes
- Learning profile, topic mastery, mistakes and attempts load from server APIs.
- Failed attempt/session writes no longer silently fall back to local learning calculations.
- Local chapter memory is retained only as a UI cache and is refreshed from successful server responses.
- Client-side chapter progress is no longer written from learning attempts, preventing a second progress authority.
- Hard-coded daily-plan fallback was removed; the UI now surfaces a server load error rather than silently presenting unrelated curriculum content.
- In production/durable mode, server persistence failures return HTTP 503 instead of reporting success.
- `/api/health` exposes durable-memory status for deployment checks.

## Required production configuration
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_AUTH_REQUIRED=true`, and `SUPABASE_DURABLE_MEMORY_REQUIRED=true`.

## Verification checklist
1. Login with an authenticated parent/student.
2. Complete one tutor question.
3. Confirm `learning_attempts` and `topic_masteries` change in Supabase.
4. Refresh the browser and confirm the same mastery is returned from the API.
5. Clear learning-memory localStorage and reload; data must still be present.
6. Temporarily break Supabase credentials and verify learning writes return 503 rather than being stored only in localStorage.
7. Verify one student cannot access another student's `/api/student/:id/*` endpoints.
