import { KnowledgeDocument, DocumentChunk, RetrievedChunkResult, GroundedSourceAttribution } from '../types';
import { SupabaseRestClient } from './supabaseRest';

export class SupabaseKnowledgeRepository {
  constructor(private readonly db: SupabaseRestClient) {}

  private async resolveId(table: 'subjects' | 'chapters', legacyId?: string): Promise<string | null> {
    if (!legacyId) return null;
    const rows = await this.db.select<{ id: string; legacy_id?: string }>(table, `legacy_id=eq.${encodeURIComponent(legacyId)}&select=id`, { single: false }) as any[];
    return rows[0]?.id || null;
  }

  private mapDocument(row: any): KnowledgeDocument {
    return {
      ...row,
      id: row.legacy_id || row.id,
      document_id: row.legacy_id || row.id,
      doc_type: row.doc_type,
      document_type: row.doc_type,
      subject_id: row.subject_legacy_id || row.subject_id,
      chapter_id: row.chapter_legacy_id || row.chapter_id,
      chunk_count: Number(row.chunk_count || 0),
      version: Number(row.version || 1),
      active: row.active !== false,
      class: row.class || '5',
      board: row.board || 'CBSE',
      academic_year: row.academic_year || '2026-27',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      embedding_status: row.embedding_status || 'pending',
      processing_status: row.processing_status || 'pending',
    } as KnowledgeDocument;
  }

  private mapChunk(row: any): DocumentChunk {
    return {
      id: row.legacy_id || row.id,
      document_id: row.document_legacy_id || row.document_id,
      document_title: row.document_title,
      document_type: row.document_type || row.doc_type,
      chunk_index: row.chunk_index,
      content: row.content,
      page_number: row.page_number,
      subject_id: row.subject_legacy_id || row.subject_id,
      chapter_id: row.chapter_legacy_id || row.chapter_id,
      chapter_name: row.chapter_name,
      topic: row.topic,
      class: row.class,
      board: row.board,
      embedding: undefined,
      created_at: row.created_at,
    } as DocumentChunk;
  }

  async listDocuments(filter?: { subject_id?: string; chapter_id?: string }): Promise<KnowledgeDocument[]> {
    let subjectUuid: string | null = null;
    let chapterUuid: string | null = null;
    if (filter?.subject_id) subjectUuid = await this.resolveId('subjects', filter.subject_id);
    if (filter?.chapter_id) chapterUuid = await this.resolveId('chapters', filter.chapter_id);

    const clauses = ['active=eq.true'];
    if (subjectUuid) clauses.push(`subject_id=eq.${encodeURIComponent(subjectUuid)}`);
    if (chapterUuid) clauses.push(`chapter_id=eq.${encodeURIComponent(chapterUuid)}`);
    const rows = await this.db.select<any>('knowledge_documents', `${clauses.join('&')}&select=*,subjects:subject_id(legacy_id),chapters:chapter_id(legacy_id)&order=created_at.desc`);
    return (rows as any[]).map(r => this.mapDocument({
      ...r,
      subject_legacy_id: r.subjects?.legacy_id,
      chapter_legacy_id: r.chapters?.legacy_id,
    }));
  }

  async getDocumentById(id: string): Promise<KnowledgeDocument | undefined> {
    const rows = await this.db.select<any>('knowledge_documents', `legacy_id=eq.${encodeURIComponent(id)}&select=*,subjects:subject_id(legacy_id),chapters:chapter_id(legacy_id)`) as any[];
    if (!rows[0]) return undefined;
    return this.mapDocument({ ...rows[0], subject_legacy_id: rows[0].subjects?.legacy_id, chapter_legacy_id: rows[0].chapters?.legacy_id });
  }

  async getChunksForDocument(documentId: string): Promise<DocumentChunk[]> {
    const docs = await this.db.select<{ id: string }>('knowledge_documents', `legacy_id=eq.${encodeURIComponent(documentId)}&select=id`) as any[];
    if (!docs[0]) return [];
    const rows = await this.db.select<any>('knowledge_chunks', `document_id=eq.${encodeURIComponent(docs[0].id)}&select=*,knowledge_documents:document_id(title,doc_type,legacy_id,subject_id,chapter_id,chapters:chapter_id(name),subjects:subject_id(legacy_id))&order=chunk_index.asc`) as any[];
    return rows.map(r => this.mapChunk({
      ...r,
      document_title: r.knowledge_documents?.title,
      document_type: r.knowledge_documents?.doc_type,
      document_legacy_id: r.knowledge_documents?.legacy_id,
      subject_legacy_id: r.knowledge_documents?.subjects?.legacy_id,
      chapter_legacy_id: r.knowledge_documents?.chapters?.name ? undefined : undefined,
      chapter_name: r.knowledge_documents?.chapters?.name,
    }));
  }

  async upsertDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    const subjectUuid = await this.resolveId('subjects', doc.subject_id);
    const chapterUuid = await this.resolveId('chapters', doc.chapter_id);
    const row = {
      legacy_id: doc.id,
      title: doc.title,
      doc_type: doc.document_type || doc.doc_type || 'textbook',
      subject_id: subjectUuid,
      chapter_id: chapterUuid,
      topic: doc.topic || null,
      class: doc.class || '5',
      board: doc.board || 'CBSE',
      academic_year: doc.academic_year || '2026-27',
      file_url: doc.file_url || null,
      content_text: null,
      embedding_status: doc.embedding_status || 'pending',
      processing_status: doc.processing_status || 'pending',
      failure_reason: doc.failure_reason || null,
      chunk_count: doc.chunk_count || 0,
      active: doc.active !== false,
      updated_at: doc.updated_at,
    };
    const rows = await this.db.upsert<any>('knowledge_documents', row, 'legacy_id');
    return this.mapDocument(rows[0]);
  }

  async replaceChunks(doc: KnowledgeDocument, chunks: DocumentChunk[]): Promise<void> {
    const docs = await this.db.select<{ id: string }>('knowledge_documents', `legacy_id=eq.${encodeURIComponent(doc.id)}&select=id`) as any[];
    if (!docs[0]) throw new Error('SUPABASE_DOCUMENT_NOT_FOUND');
    const subjectUuid = await this.resolveId('subjects', doc.subject_id);
    const chapterUuid = await this.resolveId('chapters', doc.chapter_id);
    const rows = chunks.map(c => ({
      legacy_id: c.id,
      document_id: docs[0].id,
      chunk_index: c.chunk_index,
      content: c.content,
      page_number: c.page_number || null,
      topic: c.topic || null,
      metadata: { document_title: c.document_title, document_type: c.document_type, subject_legacy_id: doc.subject_id, chapter_legacy_id: doc.chapter_id, chapter_name: c.chapter_name, board: c.board, class: c.class },
      subject_id: subjectUuid,
      chapter_id: chapterUuid,
      document_title: c.document_title,
      document_type: c.document_type,
      chapter_name: c.chapter_name || null,
      class: c.class || '5',
      board: c.board || 'CBSE',
      embedding: c.embedding ? `[${c.embedding.join(',')}]` : null,
    }));
    if (rows.length) await this.db.upsert('knowledge_chunks', rows, 'document_id,chunk_index');
  }

  async deleteDocument(id: string): Promise<boolean> {
    const rows = await this.db.update<any>('knowledge_documents', `legacy_id=eq.${encodeURIComponent(id)}`, { active: false });
    return rows.length > 0;
  }

  async vectorSearch(params: { queryEmbedding: number[]; limit: number; subject_id?: string; chapter_id?: string; topic?: string }): Promise<RetrievedChunkResult[]> {
    const subjectUuid = await this.resolveId('subjects', params.subject_id);
    const chapterUuid = await this.resolveId('chapters', params.chapter_id);
    const rows = await this.db.rpc<any>('match_knowledge_chunks', {
      query_embedding: `[${params.queryEmbedding.join(',')}]`,
      match_count: Math.max(params.limit * 4, 20),
      filter_subject_id: subjectUuid,
      filter_chapter_id: chapterUuid,
      filter_topic: params.topic || null,
    });
    return (rows as any[]).map(r => ({
      chunk: this.mapChunk(r),
      similarity: Number(r.similarity || 0),
      relevanceScore: Number(r.similarity || 0),
      matchReasons: [`Vector Match (${(Number(r.similarity || 0) * 100).toFixed(0)}%)`],
    }));
  }

  async countAvailable(params: { subject_id?: string; chapter_id?: string }): Promise<number> {
    const subjectUuid = await this.resolveId('subjects', params.subject_id);
    const chapterUuid = await this.resolveId('chapters', params.chapter_id);
    const clauses = ['active=eq.true'];
    if (subjectUuid) clauses.push(`subject_id=eq.${encodeURIComponent(subjectUuid)}`);
    if (chapterUuid) clauses.push(`chapter_id=eq.${encodeURIComponent(chapterUuid)}`);
    const rows = await this.db.select<any>('knowledge_chunks', `${clauses.join('&')}&select=id`);
    return (rows as any[]).length;
  }
}
