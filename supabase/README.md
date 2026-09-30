# Athmik AI Tutor — Supabase Production Foundation

This directory contains the next architecture-hardening step. It does **not** add UI features.

## What this migration establishes

- Supabase Auth ownership links for parents/students.
- Normalized topic mastery.
- Immutable learning-attempt history.
- One active tutor question per student.
- Normalized mistake records.
- Durable learning sessions and daily activity.
- PostgreSQL/pgvector storage for RAG chunks.
- Row Level Security policies around student-owned learning data.
- Server-side `updated_at` triggers.

## Important deployment order

1. Create/confirm the Supabase project.
2. Run the existing foundation schema first if the project is empty.
3. Run `migrations/20260930_production_memory.sql`.
4. Create Auth users and populate `parents.auth_user_id` / `students.auth_user_id`.
5. Backfill the existing JSON learning-memory data into the normalized tables.
6. Only then switch the application repository from JSON/localStorage writes to Supabase writes.

The current application deliberately remains compatible with its existing local/server storage until the backfill is verified. This avoids silently losing learning history.

## Security rule

`SUPABASE_SERVICE_ROLE_KEY` must only exist on the trusted server. It must never be placed in Vite client environment variables or browser code.
