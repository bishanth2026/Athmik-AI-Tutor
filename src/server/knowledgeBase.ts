import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createSupabaseRestClient } from './supabaseRest';
import { SupabaseKnowledgeRepository } from './supabaseKnowledgeRepository';
import {
  KnowledgeDocument,
  DocumentChunk,
  DocumentType,
  RetrievedChunkResult,
  GroundedSourceAttribution,
} from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DOCS_FILE = path.join(DATA_DIR, 'knowledge_documents.json');
const CHUNKS_FILE = path.join(DATA_DIR, 'knowledge_chunks.json');

// Document priority weight
const DOC_TYPE_PRIORITY: Record<DocumentType, number> = {
  textbook: 1.25,
  school_note: 1.15,
  worksheet: 1.05,
  question_paper: 1.05,
  revision_material: 1.0,
  other: 0.95,
};

export class KnowledgeBaseService {
  private ai: GoogleGenAI;
  private documents: KnowledgeDocument[] = [];
  private chunks: DocumentChunk[] = [];
  private isInitialized = false;
  private readonly remote: SupabaseKnowledgeRepository | null;
  private readonly embeddingCache = new Map<string, { expiresAt: number; value: number[] | null }>();
  private readonly searchCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<KnowledgeBaseService['searchKnowledge']>> }>();
  private readonly embeddingTtlMs = 5 * 60_000;
  private readonly searchTtlMs = 60_000;

  constructor(aiClient: GoogleGenAI) {
    this.ai = aiClient;
    const db = createSupabaseRestClient();
    this.remote = db ? new SupabaseKnowledgeRepository(db) : null;
    this.ensureDataStorage();
  }

  private ensureDataStorage(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DOCS_FILE)) {
      try {
        const raw = fs.readFileSync(DOCS_FILE, 'utf-8');
        this.documents = JSON.parse(raw);
      } catch (err) {
        console.error('[KnowledgeBase] Failed to load documents file:', err);
        this.documents = [];
      }
    } else {
      this.documents = [];
      this.saveDocuments();
    }

    if (fs.existsSync(CHUNKS_FILE)) {
      try {
        const raw = fs.readFileSync(CHUNKS_FILE, 'utf-8');
        this.chunks = JSON.parse(raw);
      } catch (err) {
        console.error('[KnowledgeBase] Failed to load chunks file:', err);
        this.chunks = [];
      }
    } else {
      this.chunks = [];
      this.saveChunks();
    }
  }

  private saveDocuments(): void {
    fs.writeFileSync(DOCS_FILE, JSON.stringify(this.documents, null, 2), 'utf-8');
  }

  private saveChunks(): void {
    fs.writeFileSync(CHUNKS_FILE, JSON.stringify(this.chunks, null, 2), 'utf-8');
  }

  /**
   * Initializes Knowledge Base with authentic CBSE Class 5 Textbook data if empty
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // When Supabase is configured, it is authoritative for runtime RAG.
    const remoteDocs = this.remote ? await this.remote.listDocuments({ subject_id: 'sub_maths', chapter_id: 'chap_math_1' }) : [];
    const hasFishTaleDoc = remoteDocs.some((d) => d.active) || this.documents.some(
      (d) => d.subject_id === 'sub_maths' && d.chapter_number === 1 && d.active
    );

    if (!hasFishTaleDoc) {
      console.log('[KnowledgeBase] Seeding authentic NCERT CBSE Class 5 Mathematics Chapter 1: The Fish Tale...');
      await this.seedFishTaleTextbook();
    }
  }

  public async getDocuments(filter?: { subject_id?: string; chapter_id?: string }): Promise<KnowledgeDocument[]> {
    if (this.remote) return this.remote.listDocuments(filter);
    return this.documents.filter((doc) => {
      if (filter?.subject_id && doc.subject_id !== filter.subject_id) return false;
      if (filter?.chapter_id && doc.chapter_id !== filter.chapter_id) return false;
      return true;
    });
  }

  public async getDocumentById(id: string): Promise<KnowledgeDocument | undefined> {
    if (this.remote) return this.remote.getDocumentById(id);
    return this.documents.find((d) => d.id === id);
  }

  public async getChunksForDocument(documentId: string): Promise<DocumentChunk[]> {
    if (this.remote) return this.remote.getChunksForDocument(documentId);
    return this.chunks.filter((c) => c.document_id === documentId);
  }

  public async deleteDocument(documentId: string): Promise<boolean> {
    if (this.remote) return this.remote.deleteDocument(documentId);
    const initialDocCount = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== documentId);
    this.chunks = this.chunks.filter((c) => c.document_id !== documentId);
    this.saveDocuments();
    this.saveChunks();
    console.log(`[KnowledgeBase] Deleted document ${documentId} and all associated chunks.`);
    return this.documents.length < initialDocCount;
  }

  /**
   * Embed text using gemini-embedding-001 with fallback protection
   */
  public async generateEmbedding(text: string): Promise<number[] | null> {
    const key = text.trim().slice(0, 2000);
    const cached = this.embeddingCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const res = await this.ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text.slice(0, 2000), // optimal window
      });

      const values = res.embeddings?.[0]?.values;
      if (Array.isArray(values) && values.length > 0) {
        this.embeddingCache.set(key, { expiresAt: Date.now() + this.embeddingTtlMs, value: values });
        return values;
      }
      this.embeddingCache.set(key, { expiresAt: Date.now() + this.embeddingTtlMs, value: null });
      return null;
    } catch (err: any) {
      console.warn(`[KnowledgeBase] Embedding generation skipped/failed: ${err?.message?.slice(0, 80)}`);
      this.embeddingCache.set(key, { expiresAt: Date.now() + this.embeddingTtlMs, value: null });
      return null;
    }
  }

  /**
   * Split document text into educational chunks respecting section boundaries
   */
  public chunkText(
    text: string,
    options: {
      documentId: string;
      documentTitle: string;
      documentType: DocumentType;
      subjectId: string;
      chapterId?: string;
      chapterName?: string;
      topic?: string;
      pageNumber?: number;
    }
  ): Omit<DocumentChunk, 'id' | 'embedding' | 'created_at'>[] {
    const rawParagraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    const chunks: Omit<DocumentChunk, 'id' | 'embedding' | 'created_at'>[] = [];
    let currentChunk = '';
    let currentPage = options.pageNumber || 1;
    let chunkIndex = 0;

    for (const paragraph of rawParagraphs) {
      // Check for page marker like [Page 3] or Page 3:
      const pageMatch = paragraph.match(/\[Page\s+(\d+)\]/i) || paragraph.match(/^Page\s+(\d+):/i);
      if (pageMatch) {
        currentPage = parseInt(pageMatch[1], 10);
      }

      if (currentChunk.length + paragraph.length > 700 && currentChunk.length >= 250) {
        chunks.push({
          document_id: options.documentId,
          document_title: options.documentTitle,
          document_type: options.documentType,
          chunk_index: chunkIndex++,
          content: currentChunk.trim(),
          page_number: currentPage,
          subject_id: options.subjectId,
          chapter_id: options.chapterId,
          chapter_name: options.chapterName,
          topic: options.topic,
          class: '5',
          board: 'CBSE',
        });
        currentChunk = '';
      }

      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        document_id: options.documentId,
        document_title: options.documentTitle,
        document_type: options.documentType,
        chunk_index: chunkIndex++,
        content: currentChunk.trim(),
        page_number: currentPage,
        subject_id: options.subjectId,
        chapter_id: options.chapterId,
        chapter_name: options.chapterName,
        topic: options.topic,
        class: '5',
        board: 'CBSE',
      });
    }

    return chunks;
  }

  /**
   * Process raw document text or file buffer into chunks and vector embeddings
   */
  public async processAndStoreDocument(
    docMeta: Omit<KnowledgeDocument, 'id' | 'created_at' | 'updated_at' | 'chunk_count'>,
    extractedPages: { pageNumber: number; text: string }[]
  ): Promise<KnowledgeDocument> {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const totalTextLength = extractedPages.reduce((acc, p) => acc + p.text.trim().length, 0);
    if (totalTextLength === 0) {
      const failedDoc: KnowledgeDocument = {
        ...docMeta,
        id: docId,
        document_id: docId,
        chunk_count: 0,
        processing_status: 'failed',
        embedding_status: 'failed',
        failure_reason: 'Text extraction was not available for this document. It may be a scanned or image-only file.',
        created_at: now,
        updated_at: now,
      };
      this.documents.unshift(failedDoc);
      this.saveDocuments();
      if (this.remote) {
        const remoteDoc = await this.remote.upsertDocument(failedDoc);
        return remoteDoc;
      }
      return failedDoc;
    }

    const newDoc: KnowledgeDocument = {
      ...docMeta,
      id: docId,
      document_id: docId,
      chunk_count: 0,
      processing_status: 'processing',
      embedding_status: 'pending',
      created_at: now,
      updated_at: now,
    };
    this.documents.unshift(newDoc);
    this.saveDocuments();

    const createdChunks: DocumentChunk[] = [];

    for (const page of extractedPages) {
      if (!page.text.trim()) continue;

      const rawChunks = this.chunkText(page.text, {
        documentId: docId,
        documentTitle: docMeta.title,
        documentType: docMeta.document_type || docMeta.doc_type || 'textbook',
        subjectId: docMeta.subject_id,
        chapterId: docMeta.chapter_id,
        chapterName: docMeta.chapter_name,
        topic: docMeta.topic,
        pageNumber: page.pageNumber,
      });

      for (const rc of rawChunks) {
        const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const embedding = await this.generateEmbedding(rc.content);

        const chunk: DocumentChunk = {
          ...rc,
          id: chunkId,
          embedding: embedding || undefined,
          created_at: now,
        };
        createdChunks.push(chunk);
      }
    }

    newDoc.chunk_count = createdChunks.length;
    newDoc.processing_status = 'completed';
    newDoc.embedding_status = createdChunks.some((c) => !!c.embedding) ? 'processed' : 'pending';
    newDoc.updated_at = new Date().toISOString();

    this.chunks.push(...createdChunks);
    this.saveDocuments();
    this.saveChunks();

    if (this.remote) {
      const remoteDoc = await this.remote.upsertDocument(newDoc);
      await this.remote.replaceChunks(remoteDoc, createdChunks);
      console.log(`[KnowledgeBase] Durable Supabase RAG index updated for ${remoteDoc.id}.`);
      return remoteDoc;
    }

    console.log(`[KnowledgeBase] Processed document "${newDoc.title}": ${createdChunks.length} chunks indexed.`);
    return newDoc;
  }

  /**
   * Hybrid RAG Retrieval:
   * 1. Metadata filtering (Class=5, Board=CBSE, Subject, Chapter priority)
   * 2. Semantic Cosine Similarity (via gemini-embedding-001)
   * 3. Keyword / BM25 lexical overlap
   * 4. Document-Type authoritative weighting (Textbook > Notes > Worksheets)
   */
  public async searchKnowledge(params: {
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
    results: RetrievedChunkResult[];
    queryEmbeddingGenerated: boolean;
    totalAvailableChunks: number;
    sources: GroundedSourceAttribution[];
  }> {
    const minScore = params.minScore ?? 0.35;
    const limit = params.limit ?? 5;
    const cacheKey = JSON.stringify({
      q: params.query.trim().toLowerCase(),
      class: params.class,
      board: params.board,
      subject_id: params.subject_id,
      chapter_id: params.chapter_id,
      chapter_number: params.chapter_number,
      topic: params.topic,
      minScore,
      limit,
    });
    const cachedSearch = this.searchCache.get(cacheKey);
    if (cachedSearch && cachedSearch.expiresAt > Date.now()) return cachedSearch.value;

    // 1. Generate query embedding
    const queryEmbedding = await this.generateEmbedding(params.query);

    if (this.remote && queryEmbedding) {
      try {
      const vectorResults = await this.remote.vectorSearch({
        queryEmbedding,
        limit: Math.max(limit * 3, 15),
        subject_id: params.subject_id,
        chapter_id: params.chapter_id,
        topic: params.topic,
      });
      const results = vectorResults
        .filter(r => r.similarity >= minScore)
        .slice(0, limit);
      const sources: GroundedSourceAttribution[] = [];
      const seen = new Set<string>();
      for (const r of results) {
        const key = `${r.chunk.document_id}_${r.chunk.page_number || 1}`;
        if (!seen.has(key)) {
          seen.add(key);
          sources.push({
            documentId: r.chunk.document_id,
            documentTitle: r.chunk.document_title,
            documentType: r.chunk.document_type,
            chapter: r.chunk.chapter_name,
            pageNumber: r.chunk.page_number,
            chunkIndex: r.chunk.chunk_index,
            relevanceScore: r.relevanceScore,
          });
        }
      }
      const value = {
        results,
        queryEmbeddingGenerated: true,
        totalAvailableChunks: await this.remote.countAvailable({ subject_id: params.subject_id, chapter_id: params.chapter_id }),
        sources,
      };
      this.searchCache.set(cacheKey, { expiresAt: Date.now() + this.searchTtlMs, value });
      return value;
      } catch (remoteError) {
        console.warn('[KnowledgeBase] Remote vector search failed; falling back to local lexical retrieval:', remoteError);
      }
    }

    // 2. Extract query keywords
    const queryTokens = params.query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['what', 'this', 'that', 'about', 'chapter', 'tell', 'show', 'explain', 'with', 'from'].includes(w));

    // 3. Filter candidate chunks by curriculum context (Rule 12: Chapter boundary filtering)
    const candidates = this.chunks.filter((c) => {
      // Must match Class 5 CBSE if specified
      if (params.class && c.class !== params.class) return false;
      if (params.board && c.board !== params.board) return false;
      // Must match Subject if specified
      if (params.subject_id && c.subject_id !== params.subject_id) return false;
      // Must not bleed other chapters into current chapter session unless general material
      if (params.chapter_id && c.chapter_id && c.chapter_id !== params.chapter_id) return false;
      return true;
    });

    const scoredResults: RetrievedChunkResult[] = [];

    for (const chunk of candidates) {
      const matchReasons: string[] = [];
      let semanticScore = 0;

      // Semantic Cosine Similarity
      if (queryEmbedding && chunk.embedding && chunk.embedding.length === queryEmbedding.length) {
        semanticScore = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        if (semanticScore > 0.45) {
          matchReasons.push(`Semantic Match (${(semanticScore * 100).toFixed(0)}%)`);
        }
      }

      // Lexical Keyword Matching
      const contentLower = chunk.content.toLowerCase();
      let matchedTokens = 0;
      for (const token of queryTokens) {
        if (contentLower.includes(token)) {
          matchedTokens++;
        }
      }
      const lexicalScore = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0;
      if (lexicalScore > 0) {
        matchReasons.push(`Keyword Match (${matchedTokens}/${queryTokens.length})`);
      }

      // Exact Chapter Match Bonus
      let chapterBonus = 0;
      if (params.chapter_id && chunk.chapter_id === params.chapter_id) {
        chapterBonus = 0.25;
        matchReasons.push('Current Chapter Prioritized');
      } else if (params.chapter_number && chunk.chapter_name?.toLowerCase().includes(`chapter ${params.chapter_number}`)) {
        chapterBonus = 0.25;
        matchReasons.push('Current Chapter Prioritized');
      }

      // Document Type Authority Weighting
      const docType = chunk.document_type || 'textbook';
      const typeWeight = DOC_TYPE_PRIORITY[docType] || 1.0;

      // Composite Score Calculation
      let compositeScore = 0;
      if (queryEmbedding && chunk.embedding) {
        compositeScore = (semanticScore * 0.65 + lexicalScore * 0.35 + chapterBonus) * typeWeight;
      } else {
        compositeScore = (lexicalScore * 0.75 + chapterBonus) * typeWeight;
      }

      // Baseline relevance for chapter matching when query is broad like "What is this chapter about?"
      if (params.chapter_id && chunk.chapter_id === params.chapter_id) {
        if (compositeScore < 0.40) {
          compositeScore += 0.25;
        }
      }

      if (compositeScore >= minScore) {
        scoredResults.push({
          chunk,
          similarity: semanticScore,
          relevanceScore: Math.min(1.0, compositeScore),
          matchReasons,
        });
      }
    }

    // Sort by relevance score descending
    scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topResults = scoredResults.slice(0, limit);

    // Format unique sources for attribution
    const sources: GroundedSourceAttribution[] = [];
    const seenSources = new Set<string>();

    for (const r of topResults) {
      const key = `${r.chunk.document_id}_${r.chunk.page_number || 1}`;
      if (!seenSources.has(key)) {
        seenSources.add(key);
        sources.push({
          documentId: r.chunk.document_id,
          documentTitle: r.chunk.document_title,
          documentType: r.chunk.document_type,
          chapter: r.chunk.chapter_name,
          pageNumber: r.chunk.page_number,
          chunkIndex: r.chunk.chunk_index,
          relevanceScore: r.relevanceScore,
        });
      }
    }

    const value = {
      results: topResults,
      queryEmbeddingGenerated: !!queryEmbedding,
      totalAvailableChunks: candidates.length,
      sources,
    };
    this.searchCache.set(cacheKey, { expiresAt: Date.now() + this.searchTtlMs, value });
    return value;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Seed authentic CBSE Class 5 Mathematics Textbook - Chapter 1: The Fish Tale
   */
  private async seedFishTaleTextbook(): Promise<void> {
    const textbookPages = [
      {
        pageNumber: 1,
        text: `NCERT Class 5 Mathematics Math-Magic - Chapter 1: The Fish Tale

Deep in the sea so blue,
See the lovely coloured fish
Swimming peacefully.
This special poem in three lines is called a Haiku! Such poems about nature are popular in Japan.

When you think of fishes, what shapes come to your mind?
Try to use a square and a triangle to draw a fish.
Look for fish designs around you - on cloth, in paintings, on mats, etc. 'Meen' means a fish and 'Meenakshi' is a girl whose eyes look like a fish!
Fishes can have very different sizes. The smallest fish is about one centimetre long.
How long is the biggest fish you can imagine?`,
      },
      {
        pageNumber: 2,
        text: `The biggest fish is the whale shark. It is actually not a whale, but a big, big fish!
Whales are different from fish. Whales breathe like we do, through their noses, but fish have no noses and they take in water, not air.
Whales give birth to babies, but fish lay eggs.
The whale shark fish looks big and dangerous, but is quite harmless. It does not attack humans.

One whale shark was as long as 18 metres. Just think how long that is - almost 12 children of your size standing one on top of the other!
And guess how much it weighed? Almost 16,000 kilograms!
About how many kilograms do you weigh? (A Class 5 student weighs about 30 kg).
So 12 children like you put together will weigh about 360 kg (12 x 30 = 360 kg).
How much more does the whale shark weigh than 12 children? (16,000 kg - 360 kg = 15,640 kg more!)`,
      },
      {
        pageNumber: 4,
        text: `Log Boats and Fishermen:
To see the difference between whales and fish, look closely at their tails. The tail of the fish stands flat along its body, but the tail of the whale almost looks like two legs.
Can you spot the fish in the picture?

Fishermen in their boats:
How many of you have seen the sea? Where did you see it?
Did you see it in a movie or for real? How deep do you think the sea is?
Fishermen can feel the wind and look at the sun to find which way to go.
Many of us would get lost and not know which way to go when there is only water everywhere!

Log boats:
These boats do not go very far. If the wind is helpful, they go about 4 kilometres in one hour.
Calculation 1: How long will they take to go a distance of 10 kilometres?
In 1 hour: 4 km.
In 2 hours: 8 km.
To go remaining 2 km (which is half of 4 km): half an hour.
Total time = 2 hours and 30 minutes!
Calculation 2: Guess how far you can go in one hour if you walk fast? (About 4 to 5 km).`,
      },
      {
        pageNumber: 6,
        text: `Different Types of Boats and Their Catches:
Fishermen want big catches, so they go further out into the sea where big fishes are found.
Different boats have different speeds and catch capacities:

1. Log Boat:
- Speed: 4 km in 1 hour.
- Catch capacity: About 20 kg of fish in one trip.

2. Long Tail Boat:
- Speed: 12 km in 1 hour.
- Catch capacity: About 600 kg of fish in one trip.

3. Motor Boat:
- Speed: 20 km in 1 hour.
- Catch capacity: About 800 kg of fish in one trip.
- In 6 hours, a motor boat travels: 20 km x 6 = 120 kilometres!
- To travel 85 km, a motor boat takes: 85 / 20 = 4.25 hours (4 hours and 15 minutes).

4. Big Machine Boat (Trawler):
- Speed: 24 km in 1 hour.
- Catch capacity: About 6,000 kg of fish in one trip!`,
      },
      {
        pageNumber: 9,
        text: `The Fish Market:
Have you been to a fish market? If you have, then you might know why a very noisy place is sometimes called a "fish market"!
The fish market is buzzing with activity today. Many boats have brought a good catch. The fisherwomen are shouting out their prices to the buyers:

Official Fish Price List in Market:
- Mini: "Come here! Come here! Take sardines at ₹40 a kg!"
- Gracy: "Never so cheap! Get swordfish for ₹60 a kg!"
- Floramma sells prawns for ₹150 a kg.
- Karuthamma sells squid for ₹50 a kg.
- Fazila: "Look, Fazila can hardly carry this big Kingfish! She says, this fish weighs 8 kg. I will sell the whole fish for ₹1,200."
  Therefore, price of Kingfish per kg = ₹1,200 / 8 kg = ₹150 per kg!`,
      },
      {
        pageNumber: 10,
        text: `Practice Problems from the Fish Market:
Problem 1: At what price per kg did Fazila sell the Kingfish?
Answer: ₹1,200 / 8 = ₹150 per kg.

Problem 2: Floramma has sold 10 kg prawns today. How much money did she get for that?
Floramma sells prawns at ₹150 per kg.
For 10 kg: 10 x ₹150 = ₹1,500.

Problem 3: Gracy sold 6 kg swordfish. Mini has earned the same amount of money as Gracy. How many kilograms of sardines did Mini sell?
Gracy earned: 6 kg x ₹60 = ₹360.
Mini sells sardines at ₹40 per kg.
Kilograms of sardines sold by Mini = ₹360 / ₹40 = 9 kg of sardines!

Problem 4: Bashir has ₹100. He spends one-fourth (1/4) of the money on squid and three-fourths (3/4) on prawns.
One-fourth of ₹100 = ₹25. Squid price = ₹50/kg. So he gets 1/2 kg squid (25/50).
Three-fourths of ₹100 = ₹75. Prawns price = ₹150/kg. So he gets 1/2 kg prawns (75/150).`,
      },
      {
        pageNumber: 11,
        text: `Women's 'Meenkar Bank':
The meeting of the Meenkar Bank has just begun. Fazila is the president. Twenty fisherwomen have made their own bank. Each saves ₹25 every month and puts it in the bank.

Question 1: How much money does the group collect each month?
Calculation: 20 women x ₹25 = ₹500 every month!

Question 2: How much money will be collected in 10 years?
There are 12 months in 1 year, so in 10 years there are 120 months.
Total money in 10 years = 120 months x ₹500 = ₹60,000!

Why is the bank useful?
The women can get small loans from the bank for buying nets, repairing boats, or buying baskets. They pay back the loan with a small interest.`,
      },
      {
        pageNumber: 12,
        text: `Bank Loan Calculations:
Gracy took a loan of ₹4,000 to buy a net. She paid back ₹345 every month for one year.
Calculation:
1 year = 12 months.
Total amount paid back = 12 x ₹345 = ₹4,140.
Interest paid = ₹4,140 - ₹4,000 = ₹140.

Jhansi and her sister took a loan of ₹21,000 to buy a log boat.
They paid back a total of ₹23,520 in one year.
Amount paid back each month = ₹23,520 / 12 = ₹1,960 per month!`,
      },
      {
        pageNumber: 13,
        text: `Factory to Dry Fish:
The women of Meenkar Bank also want to start a small factory to dry fish.
The Panchayat has given them some land. Over the years they have saved ₹74,000.
They find out how much they will need for the factory:

Key rule of drying fish:
When fresh fish is dried, it becomes one-third (1/3) of its weight!
If they plan to dry 6,000 kg of fresh fish in a month:
Dried fish obtained = 6,000 kg / 3 = 2,000 kg of dried fish.

Costs and Profit:
- We buy fresh fish for: ₹15 per kg.
- We sell dried fish for: ₹70 per kg.
For 6,000 kg fresh fish:
Cost of fresh fish = 6,000 x ₹15 = ₹90,000.
Cost of salt and packing = ₹3,000.
Total cost = ₹93,000.
We get 2,000 kg dried fish. Selling price = 2,000 x ₹70 = ₹140,000!
Monthly Profit = ₹140,000 - ₹93,000 = ₹47,000!
Fazila: "I am very happy that our calculations show that each woman will earn ₹2,350 every month!"`,
      },
    ];

    await this.processAndStoreDocument(
      {
        title: 'NCERT Mathematics: Math-Magic (Class 5) - Chapter 1: The Fish Tale',
        doc_type: 'textbook',
        document_type: 'textbook',
        subject_id: 'sub_maths',
        subject_name: 'Mathematics',
        chapter_id: 'chap_math_1',
        chapter_name: 'The Fish Tale',
        chapter_number: 1,
        topic: 'Large Numbers, Speeds, Distance & Everyday Market Mathematics',
        class: '5',
        board: 'CBSE',
        academic_year: '2026-27',
        file_name: 'NCERT_MathMagic_Class5_Chapter1_TheFishTale.pdf',
        file_type: 'application/pdf',
        file_size: 452000,
        uploaded_by: 'Bishanth (Parent)',
        embedding_status: 'pending',
        processing_status: 'pending',
        version: 1,
        active: true,
      },
      textbookPages
    );
  }
}
