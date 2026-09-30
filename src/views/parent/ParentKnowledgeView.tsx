import React, { useState, useEffect } from 'react';
import {
  KnowledgeDocument,
  DocumentChunk,
  DocumentType,
  RetrievedChunkResult,
} from '../../types';
import { knowledgeService, UploadDocumentPayload } from '../../services/knowledgeService';
import { useApp } from '../../context/AppContext';
import {
  Database,
  Upload,
  Search,
  Trash2,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Sparkles,
  BookOpen,
  FileCheck,
  RefreshCw,
  X,
  FileUp,
  Layers,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface ParentKnowledgeViewProps {
  onNavigate?: (path: string) => void;
}

export const ParentKnowledgeView: React.FC<ParentKnowledgeViewProps> = ({ onNavigate }) => {
  const { subjects, chapters, student } = useApp();

  const [activeTab, setActiveTab] = useState<'documents' | 'searchTest'>('documents');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>('all');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState<DocumentType>('textbook');
  const [uploadSubjectId, setUploadSubjectId] = useState(subjects[0]?.id || 'sub_maths');
  const [uploadChapterId, setUploadChapterId] = useState('');
  const [uploadTopic, setUploadTopic] = useState('');
  const [uploadAcademicYear, setUploadAcademicYear] = useState('2026-27');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [rawTextInput, setRawTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');

  // Ingestion Stepper State
  const [uploadStep, setUploadStep] = useState<
    'idle' | 'reading' | 'extracting' | 'chunking' | 'embedding' | 'completed' | 'failed'
  >('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Chunk Viewer Modal State
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDocument | null>(null);
  const [viewingChunks, setViewingChunks] = useState<DocumentChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Delete Confirmation State
  const [docToDelete, setDocToDelete] = useState<KnowledgeDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Test Search State
  const [searchQuery, setSearchQuery] = useState('What is this chapter about?');
  const [searchSubjectId, setSearchSubjectId] = useState(subjects[0]?.id || 'sub_maths');
  const [searchChapterId, setSearchChapterId] = useState(chapters.find(c => c.subject_id === 'sub_maths')?.id || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RetrievedChunkResult[]>([]);
  const [totalChunksCount, setTotalChunksCount] = useState(0);

  const activeSubjects = subjects.filter((s) => s.active);
  const uploadChapters = chapters.filter((c) => c.subject_id === uploadSubjectId && c.active);
  const searchChapters = chapters.filter((c) => c.subject_id === searchSubjectId && c.active);

  // Load documents
  const loadDocuments = async () => {
    setIsLoading(true);
    const docs = await knowledgeService.getDocuments(
      selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined,
      selectedChapterFilter !== 'all' ? selectedChapterFilter : undefined
    );
    setDocuments(docs);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedSubjectFilter, selectedChapterFilter]);

  // Set initial chapter when subject changes in upload modal
  useEffect(() => {
    if (uploadChapters.length > 0 && !uploadChapterId) {
      setUploadChapterId(uploadChapters[0].id);
    }
  }, [uploadSubjectId]);

  // Handle Document Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadError('Please provide a document title.');
      return;
    }

    if (inputMode === 'file' && !fileToUpload) {
      setUploadError('Please select a PDF or text file to upload.');
      return;
    }

    if (inputMode === 'text' && !rawTextInput.trim()) {
      setUploadError('Please enter textbook content or notes text.');
      return;
    }

    setUploadError(null);
    setUploadStep('reading');

    try {
      const selectedSub = subjects.find((s) => s.id === uploadSubjectId);
      const selectedChap = chapters.find((c) => c.id === uploadChapterId);

      let fileDataBase64: string | undefined = undefined;
      let fileName = 'document.txt';
      let fileType = 'text/plain';
      let fileSize = 0;

      if (inputMode === 'file' && fileToUpload) {
        fileName = fileToUpload.name;
        fileType = fileToUpload.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
        fileSize = fileToUpload.size;

        // Read file as base64
        setUploadStep('extracting');
        const buffer = await fileToUpload.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileDataBase64 = btoa(binary);
      } else {
        fileName = `${uploadTitle.replace(/\s+/g, '_')}.txt`;
        fileSize = new Blob([rawTextInput]).size;
      }

      setUploadStep('chunking');

      const payload: UploadDocumentPayload = {
        title: uploadTitle.trim(),
        document_type: uploadDocType,
        subject_id: uploadSubjectId,
        subject_name: selectedSub?.name || 'Mathematics',
        chapter_id: uploadChapterId || undefined,
        chapter_name: selectedChap?.chapter_name,
        chapter_number: selectedChap?.chapter_number,
        topic: uploadTopic.trim() || undefined,
        class: '5',
        board: 'CBSE',
        academic_year: uploadAcademicYear,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_data_base64: fileDataBase64,
        raw_text: inputMode === 'text' ? rawTextInput : undefined,
      };

      setUploadStep('embedding');
      const result = await knowledgeService.uploadDocument(payload);

      if (result.success && result.data) {
        if (result.data.processing_status === 'failed') {
          setUploadStep('failed');
          setUploadError(result.data.failure_reason || 'Document processing failed.');
        } else {
          setUploadStep('completed');
          setTimeout(() => {
            setIsUploadModalOpen(false);
            setUploadStep('idle');
            setUploadTitle('');
            setFileToUpload(null);
            setRawTextInput('');
            loadDocuments();
          }, 1200);
        }
      } else {
        setUploadStep('failed');
        setUploadError(result.error || 'Failed to process document.');
      }
    } catch (err: any) {
      setUploadStep('failed');
      setUploadError(err?.message || 'Upload operation failed.');
    }
  };

  // View chunks
  const handleOpenChunks = async (doc: KnowledgeDocument) => {
    setViewingDoc(doc);
    setIsLoadingChunks(true);
    const chunks = await knowledgeService.getDocumentChunks(doc.id);
    setViewingChunks(chunks);
    setIsLoadingChunks(false);
  };

  // Delete document
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    const success = await knowledgeService.deleteDocument(docToDelete.id);
    setIsDeleting(false);
    if (success) {
      setDocToDelete(null);
      loadDocuments();
    }
  };

  // Run Test Search
  const handleExecuteTestSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const selectedChap = chapters.find((c) => c.id === searchChapterId);
    const result = await knowledgeService.searchKnowledge({
      query: searchQuery.trim(),
      class: '5',
      board: 'CBSE',
      subject_id: searchSubjectId,
      chapter_id: searchChapterId || undefined,
      chapter_number: selectedChap?.chapter_number,
      limit: 5,
      minScore: 0.35,
    });
    setSearchResults(result.results);
    setTotalChunksCount(result.totalAvailableChunks);
    setIsSearching(false);
  };

  // Document type badge helper
  const getDocTypeBadge = (type: DocumentType) => {
    switch (type) {
      case 'textbook':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Textbook (1.25x)</span>;
      case 'school_note':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">School Note (1.15x)</span>;
      case 'worksheet':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Worksheet (1.05x)</span>;
      case 'question_paper':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Question Paper (1.05x)</span>;
      case 'revision_material':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">Revision (1.0x)</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Other (0.95x)</span>;
    }
  };

  const totalChunksAllDocs = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                CBSE Textbook Knowledge Base (RAG)
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <ShieldCheck className="w-3 h-3 text-indigo-600" />
                Class 5 CBSE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Grounds Athmik's AI Tutor in verified NCERT textbooks, Amrutha Public School notes, and curriculum worksheets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveTab('searchTest')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'searchTest'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Test Search & Retrieval</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('documents');
              setIsUploadModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Indexed Documents</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{documents.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Total Knowledge Chunks</span>
          <p className="text-2xl font-black text-indigo-600 mt-1">{totalChunksAllDocs}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Vectors & Embeddings</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">3,072-D</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Target Student</span>
          <p className="text-sm font-bold text-slate-900 mt-1 truncate">{student.name} (Class {student.class})</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('documents')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'documents'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Curriculum Documents ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('searchTest')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'searchTest'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>RAG Query Inspector</span>
        </button>
      </div>

      {/* TAB 1: DOCUMENTS TABLE & LIST */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Subject:</span>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => {
                    setSelectedSubjectFilter(e.target.value);
                    setSelectedChapterFilter('all');
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Subjects</option>
                  {activeSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Chapter:</span>
                <select
                  value={selectedChapterFilter}
                  onChange={(e) => setSelectedChapterFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs truncate"
                >
                  <option value="all">All Chapters</option>
                  {chapters
                    .filter((c) => selectedSubjectFilter === 'all' || c.subject_id === selectedSubjectFilter)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Ch {c.chapter_number}: {c.chapter_name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <button
              onClick={loadDocuments}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Documents Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
                <p className="text-sm">Loading knowledge base records...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No study documents found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Upload textbook chapters, school notes, or worksheets to ground Athmik's AI Tutor in verified CBSE curriculum materials.
                </p>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload First Document</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Document Title</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Subject & Chapter</th>
                      <th className="py-3 px-4">Chunks</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div className="truncate">
                              <span className="truncate block font-bold text-slate-900">{doc.title}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{doc.file_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getDocTypeBadge(doc.document_type || doc.doc_type)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium">
                            {doc.subject_name || 'Mathematics'}
                          </div>
                          <div className="text-slate-400 text-[11px] truncate">
                            {doc.chapter_name ? `Ch ${doc.chapter_number || ''}: ${doc.chapter_name}` : 'General'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-semibold text-slate-700">
                          {doc.chunk_count} chunks
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {doc.processing_status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Indexed</span>
                            </span>
                          ) : doc.processing_status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]" title={doc.failure_reason}>
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Failed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              <span>Processing...</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap font-mono">
                          {new Date(doc.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenChunks(doc)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="View Document Chunks"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDocToDelete(doc)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TEST KNOWLEDGE SEARCH & RETRIEVAL INSPECTOR */}
      {activeTab === 'searchTest' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">RAG Semantic & Hybrid Search Inspector</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate Athmik asking a question in AI Tutor to inspect which textbook chunks, page numbers, and similarity scores are passed to Gemini.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
                <select
                  value={searchSubjectId}
                  onChange={(e) => setSearchSubjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {activeSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Chapter Context</label>
                <select
                  value={searchChapterId}
                  onChange={(e) => setSearchChapterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="">Any Chapter</option>
                  {searchChapters.map((c) => (
                    <option key={c.id} value={c.id}>Ch {c.chapter_number}: {c.chapter_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Curriculum Constraint</label>
                <input
                  type="text"
                  disabled
                  value="Class 5 CBSE (Amrutha Public School)"
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. What is this chapter about? OR Tell me about boat speeds and fish prices"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteTestSearch()}
              />
              <button
                onClick={handleExecuteTestSearch}
                disabled={isSearching}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Test Retrieval</span>
              </button>
            </div>
          </div>

          {/* Search Results Display */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Retrieved Chunks for AI Tutor Context</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {searchResults.length} chunks returned (searched {totalChunksCount} chunks)
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                No search results. Click "Test Retrieval" above to run the hybrid vector and metadata search engine.
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((res, idx) => (
                  <div key={res.chunk.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">
                          {res.chunk.document_title}
                        </span>
                        {res.chunk.page_number && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-mono font-bold">
                            Page {res.chunk.page_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          {res.matchReasons.map((reason, rIdx) => (
                            <span key={rIdx} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                              {reason}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                          {(res.relevanceScore * 100).toFixed(0)}% Score
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                      {res.chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Upload Educational Document</h3>
                  <p className="text-xs text-slate-500">PDF, teacher notes, or curriculum worksheets</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Display during upload */}
            {uploadStep !== 'idle' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Processing Pipeline</span>
                  <span className="font-mono text-indigo-600 uppercase text-[11px]">{uploadStep}</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <div className="h-1.5 rounded-full bg-indigo-600" />
                  <div className={`h-1.5 rounded-full ${['extracting', 'chunking', 'embedding', 'completed'].includes(uploadStep) ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                  <div className={`h-1.5 rounded-full ${['chunking', 'embedding', 'completed'].includes(uploadStep) ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                  <div className={`h-1.5 rounded-full ${uploadStep === 'completed' ? 'bg-emerald-600' : uploadStep === 'failed' ? 'bg-rose-500' : 'bg-slate-200'}`} />
                </div>

                <p className="text-xs text-slate-600 flex items-center gap-2">
                  {uploadStep === 'reading' && 'Reading file buffer...'}
                  {uploadStep === 'extracting' && 'Extracting page text and preserving page numbers...'}
                  {uploadStep === 'chunking' && 'Creating semantic textbook chunks & metadata...'}
                  {uploadStep === 'embedding' && 'Generating 3072-D vector embeddings with Google GenAI...'}
                  {uploadStep === 'completed' && 'Completed! Knowledge chunks indexed and searchable.'}
                  {uploadStep === 'failed' && (
                    <span className="text-rose-600 font-semibold">{uploadError}</span>
                  )}
                </p>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NCERT Mathematics Class 5 - Chapter 4: Parts and Wholes"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Document Type *</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value as DocumentType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {knowledgeService.getSupportedDocumentTypes().map((dt) => (
                      <option key={dt.type} value={dt.type}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
                  <select
                    value={uploadSubjectId}
                    onChange={(e) => setUploadSubjectId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {activeSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chapter</label>
                  <select
                    value={uploadChapterId}
                    onChange={(e) => setUploadChapterId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 truncate"
                  >
                    <option value="">General Subject Material</option>
                    {uploadChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        Ch {c.chapter_number}: {c.chapter_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Topic (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Fractions & Numerator"
                    value={uploadTopic}
                    onChange={(e) => setUploadTopic(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Source Input Mode Switcher */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-700">Input Mode:</span>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setInputMode('file')}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        inputMode === 'file' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'
                      }`}
                    >
                      Upload PDF / Document File
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('text')}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        inputMode === 'text' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'
                      }`}
                    >
                      Paste Text Directly
                    </button>
                  </div>
                </div>

                {inputMode === 'file' ? (
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-colors">
                    <input
                      type="file"
                      id="pdfFileInput"
                      accept=".pdf,.txt,.md"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setFileToUpload(file);
                        if (file && !uploadTitle) {
                          setUploadTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="pdfFileInput" className="cursor-pointer block space-y-2">
                      <FileUp className="w-8 h-8 text-indigo-600 mx-auto" />
                      <div className="text-xs font-bold text-slate-800">
                        {fileToUpload ? fileToUpload.name : 'Click to select PDF or text file'}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Supports PDF, TXT, MD (Max 25MB). Scanned image-only PDFs are safely detected.
                      </p>
                    </label>
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={5}
                      value={rawTextInput}
                      onChange={(e) => setRawTextInput(e.target.value)}
                      placeholder="Paste textbook chapter text, teacher summary notes, formulas or practice questions..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {uploadError && uploadStep !== 'failed' && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploadStep !== 'idle' && uploadStep !== 'failed'}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadStep !== 'idle' && uploadStep !== 'failed'}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 cursor-pointer"
                >
                  Process & Add to Knowledge Base
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHUNKS VIEWER DRAWER / MODAL */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 truncate">{viewingDoc.title}</h3>
                <p className="text-xs text-slate-500">
                  {viewingChunks.length} chunks indexed · Document ID: {viewingDoc.id}
                </p>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingChunks ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  <p className="text-xs">Loading chunks...</p>
                </div>
              ) : viewingChunks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No chunks generated for this document.
                </div>
              ) : (
                viewingChunks.map((c) => (
                  <div key={c.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Chunk #{c.chunk_index + 1} {c.page_number ? `· Page ${c.page_number}` : ''}</span>
                      <span className="text-emerald-600 font-semibold">3072-D Vector Ready</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Educational Document?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-semibold text-slate-700">"{docToDelete.title}"</span>?
                This will also permanently delete its {docToDelete.chunk_count} indexed knowledge chunks and embeddings.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setDocToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
