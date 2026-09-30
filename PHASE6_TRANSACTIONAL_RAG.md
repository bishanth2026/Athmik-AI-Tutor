# Athmik AI Tutor — Phase 6: Transactional Learning Engine & RAG Consolidation

## Scope
Architecture hardening only. No new user-facing feature was added.

## Changes
- Added an idempotent `client_attempt_id` to durable attempt history.
- Added PostgreSQL function `record_learning_attempt_atomic(payload jsonb)` so an evaluated attempt, topic mastery, mistake state, and student profile are committed in one database transaction.
- Supabase runtime sync now uses the atomic RPC instead of four independent writes.
- Tutor attempt persistence fails closed in durable mode; an AI response is not reported as successful when learning state could not be durably committed.
- Removed the duplicate client-side learning-attempt write from `aiTutorService`; the server is now the only learning-state writer.
- Manual attempts send a retry-safe client attempt ID.
- Client RAG document service no longer maintains a localStorage document registry; document listing/deletion are server-backed.
- Grounding is now based on explicit `usedSourceIds` returned by the model and matched against retrieved chunk IDs, instead of merely checking whether retrieval returned any chunks.
- Added source IDs to the tutor's retrieved context and structured response contract.

## Remaining architecture note
The current server `KnowledgeBaseService` still maintains its existing JSON mirror for compatibility and migration. The next hardening step should move ingestion and vector retrieval fully to Supabase/pgvector and then retire the JSON knowledge store after verification. This phase deliberately does not delete existing data.

## Verification
A clean TypeScript build could not be completed in this environment because dependencies are not installed (`vite/client` type definitions are unavailable). No claim of a successful production build is made.
