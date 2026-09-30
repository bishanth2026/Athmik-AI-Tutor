# Phase 7 — Durable RAG / pgvector Runtime

## What changed
- Supabase `knowledge_documents` and `knowledge_chunks` are now the authoritative RAG runtime store when Supabase is configured.
- `knowledge_chunks.embedding` uses pgvector `vector(3072)`.
- Added `match_knowledge_chunks()` RPC for server-side vector similarity search.
- Existing local JSON remains a migration/compatibility source, not the runtime source when Supabase is configured.
- Added `scripts/migrateKnowledgeToSupabase.ts` for one-time backfill.
- Subject/chapter legacy IDs are retained so existing application IDs continue to resolve to UUID foreign keys.
- Knowledge delete is a soft-delete (`active=false`) to preserve auditability.
- No user-facing UI/features were added.

## Deployment order
1. Apply `supabase/migrations/20260930_production_memory.sql` if not already applied.
2. Apply `supabase/migrations/20260930_rag_pgvector_runtime.sql`.
3. Ensure `subjects.legacy_id` and `chapters.legacy_id` are populated for existing curriculum rows.
4. Run `npm run migrate:knowledge` once.
5. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server.
6. Keep `SUPABASE_DURABLE_MEMORY_REQUIRED=true` in production.
7. Verify `/api/knowledge/search` returns vector-backed results.

## ANN index
The migration intentionally does not create HNSW/IVFFlat on an empty table. After enough vectors exist, create and benchmark an ANN index appropriate to the dataset size. Do not choose index parameters without measuring recall/latency.

## Rollback
If the remote RAG repository must be temporarily disabled, remove Supabase configuration from the server environment. The legacy local JSON path remains available for controlled development/rollback; do not use it as the production source of truth.
