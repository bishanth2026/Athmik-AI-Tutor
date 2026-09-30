import { KnowledgeDocument, DocumentType } from '../types';

/**
 * ATHMIK AI TUTOR - RAG & KNOWLEDGE BASE ARCHITECTURE
 * Prepares the application for ingestion of CBSE Class 5 textbooks,
 * teacher class notes, worksheets, and past question papers.
 */

const STORAGE_KEY_DOCS = 'athmik_knowledge_docs_v1';

export const ragService = {
  async getDocuments(subjectId?: string, chapterId?: string): Promise<KnowledgeDocument[]> {
    const params = new URLSearchParams();
    if (subjectId) params.set('subject_id', subjectId);
    if (chapterId) params.set('chapter_id', chapterId);
    const res = await fetch(`/api/knowledge/documents?${params.toString()}`);
    if (!res.ok) throw new Error('Knowledge documents could not be loaded.');
    const json = await res.json();
    return json.success ? json.data : [];
  },

  async deleteDocument(id: string): Promise<boolean> {
    const res = await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Knowledge document could not be deleted.');
    const json = await res.json();
    return !!json.success;
  },

  getSupportedDocumentTypes(): { type: DocumentType; label: string; description: string }[] {
    return [
      { type: 'textbook', label: 'NCERT / CBSE Textbook', description: 'Official textbook PDF or chapter scans' },
      { type: 'school_note', label: 'School Class Notes', description: 'Teacher notes from Amrutha Public School' },
      { type: 'worksheet', label: 'Practice Worksheets', description: 'Curriculum drills, questions and exercises' },
      { type: 'question_paper', label: 'Exam & Unit Test Papers', description: 'Past papers and revision model exams' },
      { type: 'revision_material', label: 'Summary & Flashcards', description: 'Key formulas, definitions and glossaries' },
    ];
  },
};
