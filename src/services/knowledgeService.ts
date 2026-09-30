import { apiFetch } from '../clientApi';
import {
  KnowledgeDocument,
  DocumentChunk,
  DocumentType,
  RetrievedChunkResult,
  GroundedSourceAttribution,
} from '../types';

export interface UploadDocumentPayload {
  title: string;
  document_type: DocumentType;
  subject_id: string;
  subject_name?: string;
  chapter_id?: string;
  chapter_name?: string;
  chapter_number?: number;
  topic?: string;
  class?: string;
  board?: string;
  academic_year?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  file_data_base64?: string;
  raw_text?: string;
}

export const knowledgeService = {
  /**
   * Fetch all knowledge documents
   */
  async getDocuments(subjectId?: string, chapterId?: string): Promise<KnowledgeDocument[]> {
    try {
      const params = new URLSearchParams();
      if (subjectId) params.append('subject_id', subjectId);
      if (chapterId) params.append('chapter_id', chapterId);

      const res = await apiFetch(`/api/knowledge/documents?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error('knowledgeService: getDocuments error', err);
      return [];
    }
  },

  /**
   * Fetch chunks for a given document
   */
  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    try {
      const res = await apiFetch(`/api/knowledge/documents/${documentId}/chunks`);
      if (!res.ok) throw new Error('Failed to fetch document chunks');
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error('knowledgeService: getDocumentChunks error', err);
      return [];
    }
  },

  /**
   * Delete a document and its associated chunks
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      const res = await apiFetch(`/api/knowledge/documents/${documentId}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (err) {
      console.error('knowledgeService: deleteDocument error', err);
      return false;
    }
  },

  /**
   * Upload and process an educational document
   */
  async uploadDocument(payload: UploadDocumentPayload): Promise<{
    success: boolean;
    data?: KnowledgeDocument;
    error?: string;
  }> {
    try {
      const res = await apiFetch('/api/knowledge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Upload request failed');
      }

      const resJson = await res.json();
      return { success: true, data: resJson.data };
    } catch (err: any) {
      console.error('knowledgeService: uploadDocument error', err);
      return { success: false, error: err?.message || 'Upload processing failed' };
    }
  },

  /**
   * Search knowledge base for testing / admin verification
   */
  async searchKnowledge(params: {
    query: string;
    class?: string;
    board?: string;
    subject_id?: string;
    chapter_id?: string;
    chapter_number?: number;
    topic?: string;
    minScore?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    results: RetrievedChunkResult[];
    sources: GroundedSourceAttribution[];
    totalAvailableChunks: number;
    error?: string;
  }> {
    try {
      const res = await apiFetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Search request failed');
      }

      const resJson = await res.json();
      return {
        success: true,
        results: resJson.results || [],
        sources: resJson.sources || [],
        totalAvailableChunks: resJson.totalAvailableChunks || 0,
      };
    } catch (err: any) {
      console.error('knowledgeService: searchKnowledge error', err);
      return {
        success: false,
        results: [],
        sources: [],
        totalAvailableChunks: 0,
        error: err?.message || 'Search execution failed',
      };
    }
  },

  /**
   * Supported educational document types with priority labels
   */
  getSupportedDocumentTypes(): { type: DocumentType; label: string; description: string; priority: number }[] {
    return [
      {
        type: 'textbook',
        label: 'CBSE / NCERT Textbook',
        description: 'Official Class 5 NCERT/CBSE Textbook (Highest priority 1.25x)',
        priority: 1,
      },
      {
        type: 'school_note',
        label: 'School Class Notes',
        description: 'Teacher notes from Amrutha Public School (High priority 1.15x)',
        priority: 2,
      },
      {
        type: 'worksheet',
        label: 'Practice Worksheets',
        description: 'Classwork drills, practice sums and exercises (1.05x)',
        priority: 3,
      },
      {
        type: 'question_paper',
        label: 'Exam & Test Papers',
        description: 'Past unit tests, term papers and model question papers (1.05x)',
        priority: 4,
      },
      {
        type: 'revision_material',
        label: 'Revision & Summary Sheets',
        description: 'Concept summaries, formula lists and key glossary terms (1.0x)',
        priority: 5,
      },
      {
        type: 'other',
        label: 'Other Educational Material',
        description: 'Supplementary study references and reading guides (0.95x)',
        priority: 6,
      },
    ];
  },
};
