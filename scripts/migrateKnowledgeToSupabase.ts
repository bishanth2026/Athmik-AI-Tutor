/**
 * One-time RAG backfill: local knowledge_documents.json / knowledge_chunks.json
 * -> Supabase knowledge_documents + pgvector knowledge_chunks.
 * Run after applying the Phase 7 RAG migration.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SupabaseRestClient } from '../src/server/supabaseRest.ts';
import { SupabaseKnowledgeRepository } from '../src/server/supabaseKnowledgeRepository.ts';
import { KnowledgeDocument, DocumentChunk } from '../src/types/index.ts';

const root = path.resolve(process.cwd());
const dataDir = path.join(root, 'data');
const read = <T>(name: string): T[] => {
  const file = path.join(dataDir, name);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T[];
};

async function main() {
  const db = new SupabaseRestClient();
  const repo = new SupabaseKnowledgeRepository(db);
  const documents = read<KnowledgeDocument>('knowledge_documents.json');
  const chunks = read<DocumentChunk>('knowledge_chunks.json');
  let migratedDocs = 0;
  let migratedChunks = 0;

  for (const doc of documents) {
    const remoteDoc = await repo.upsertDocument(doc);
    const docChunks = chunks.filter(c => c.document_id === doc.id);
    if (docChunks.length) await repo.replaceChunks(remoteDoc, docChunks);
    migratedDocs += 1;
    migratedChunks += docChunks.length;
    console.log(`RAG migrated: ${doc.id} -> ${doc.title} (${docChunks.length} chunks)`);
  }

  console.log(`RAG migration complete: ${migratedDocs} document(s), ${migratedChunks} chunk(s).`);
}

main().catch(error => {
  console.error('[RAG migration failed]', error);
  process.exit(1);
});
