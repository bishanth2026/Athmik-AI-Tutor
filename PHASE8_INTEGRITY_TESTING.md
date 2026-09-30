# Phase 8 — Automated Integrity Testing

This phase adds a dependency-light architecture integrity suite. It does not add user-facing features.

## Verified automatically

- Tutor chat authentication middleware
- Student authentication + ownership middleware
- Stable client attempt IDs in durable mode
- Atomic learning RPC and privilege restrictions
- Attempt idempotency unique index
- One active tutor question per student
- pgvector 3072-dimensional storage
- RAG inactive-document filtering
- RAG RPC privilege restrictions
- Daily-plan durable hydration
- Parent-report durable hydration
- Parent-settings durable synchronization
- Client attempt ID generation
- Removal of the old hard-coded Fish Tale daily-plan fallback
- No Gemini API key reference in the client API module

Run:

```bash
npm run test:integrity
```

## Environment limitation

A live Supabase end-to-end run was not executed in this environment because no Supabase project credentials were supplied and dependency installation timed out. Therefore this phase verifies the deployed architecture contracts statically; it does not claim that live database, authentication, pgvector, or Gemini calls were successfully exercised.

Before production deployment, run the integrity suite plus live tests against a staging Supabase project covering:

1. authenticated parent can access owned student
2. parent cannot access another student's records
3. duplicate `client_attempt_id` does not create a second attempt
4. failed atomic write leaves no partial learning state
5. restart/re-login restores mastery and active question
6. RAG retrieval returns only active, permitted sources
7. unauthorized RAG and student APIs return 401/403
8. multi-student isolation holds across all learning tables
