/**
 * Athmik AI Tutor - Database Models & Types
 * Compatible with PostgreSQL & Supabase
 */

export type UserRole = 'parent' | 'student';

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  parent_id: string;
  name: string;
  class: string;
  board: string;
  academic_year: string;
  school_name: string;
  date_of_birth: string;
  profile_photo_url?: string;
  preferred_language: string;
  learning_preference: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  class: string;
  board: string;
  icon: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface StudentSubject {
  id: string;
  student_id: string;
  subject_id: string;
  active: boolean;
  created_at: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  chapter_number: number;
  chapter_name: string;
  description: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LearningProgress {
  id: string;
  student_id: string;
  subject_id: string;
  chapter_id: string;
  topic?: string;
  status: ProgressStatus;
  mastery_score: number; // 0 - 100
  last_studied_at?: string;
  created_at: string;
  updated_at: string;
}

// Module 3: RAG & Knowledge Base Document Architecture
export type DocumentType =
  | 'textbook'
  | 'school_note'
  | 'worksheet'
  | 'question_paper'
  | 'revision_material'
  | 'other';

export type DocumentProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface KnowledgeDocument {
  id: string;
  document_id?: string;
  title: string;
  doc_type: DocumentType;
  document_type?: DocumentType;
  subject_id: string;
  subject_name?: string;
  chapter_id?: string;
  chapter_name?: string;
  chapter_number?: number;
  topic?: string;
  class: string;
  board: string;
  academic_year: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
  content_text?: string;
  uploaded_by?: string;
  embedding_status: 'pending' | 'processed' | 'failed';
  processing_status: DocumentProcessingStatus;
  failure_reason?: string;
  chunk_count: number;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  document_title: string;
  document_type: DocumentType;
  chunk_index: number;
  content: string;
  page_number?: number;
  subject_id: string;
  chapter_id?: string;
  chapter_name?: string;
  topic?: string;
  class: string;
  board: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  created_at: string;
}

export interface GroundedSourceAttribution {
  documentId: string;
  documentTitle: string;
  documentType: DocumentType;
  chapter?: string;
  chapterNumber?: number;
  pageNumber?: number;
  chunkIndex?: number;
  relevanceScore?: number;
}

export interface RetrievedChunkResult {
  chunk: DocumentChunk;
  similarity: number;
  relevanceScore: number;
  matchReasons: string[];
}

// Future-Ready: Learning Memory & Adaptive Engine Architecture
export interface LearningMemory {
  id: string;
  student_id: string;
  chapter_id: string;
  topic: string;
  mastery_level: number;
  mistakes_recorded: string[];
  last_duration_mins: number;
  preferred_explanation_style: string;
  revision_needed: boolean;
  notes?: string;
  updated_at: string;
}

// Calculated Progress Statistics
export interface SubjectProgressStat {
  subject_id: string;
  subject_name: string;
  icon: string;
  total_chapters: number;
  completed_chapters: number;
  in_progress_chapters: number;
  not_started_chapters: number;
  progress_percentage: number;
}

export interface OverallProgressStat {
  total_active_subjects: number;
  total_active_chapters: number;
  completed_chapters: number;
  in_progress_chapters: number;
  not_started_chapters: number;
  overall_progress_percentage: number;
  average_mastery_score: number;
}

// ==============================================================================
// MODULE 2: REAL PERSONAL AI TUTOR AGENT TYPES
// ==============================================================================

export type TutorMode = 'learn' | 'ask' | 'practice' | 'quiz' | 'revision';

export type AnswerEvaluationStatus = 'correct' | 'partially_correct' | 'incorrect' | 'unclear';

export interface AnswerEvaluation {
  status: AnswerEvaluationStatus;
  feedback: string;
  scoreDelta: number;
  conceptUnderstood?: string | null;
  mistake?: {
    type: string;
    description: string;
  } | null;
}

export interface TutorChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  mode: TutorMode;
  evaluation?: AnswerEvaluation;
  suggestedReplies?: string[];
  isThinking?: boolean;
  isError?: boolean;
  failedPrompt?: string;
  sources?: GroundedSourceAttribution[];
  isGrounded?: boolean;
}

// ==============================================================================
// MODULE 4: STUDENT LEARNING MEMORY & ADAPTIVE AGENT ARCHITECTURE
// ==============================================================================

export type MistakeType =
  | 'conceptual'
  | 'calculation'
  | 'reading'
  | 'reasoning'
  | 'careless'
  | 'vocabulary'
  | 'procedure'
  | 'unknown';

export interface MistakeRecord {
  id: string;
  student_id: string;
  subject_id: string;
  chapter_id: string;
  topic: string;
  question?: string;
  student_answer?: string;
  expected_answer?: string;
  mistake_type: MistakeType;
  description: string;
  explanation?: string;
  frequency: number;
  first_seen_at: string;
  last_seen_at: string;
  correct_since_mistake: number;
  resolved: boolean;
  updated_at: string;
}

export type TopicMasteryStatus = 'not_started' | 'learning' | 'needs_practice' | 'mastered';
export type MasteryStateLabel = 'foundational' | 'developing' | 'practising' | 'strong' | 'mastered';

export interface TopicAttemptRecord {
  correct: boolean;
  difficulty: number;
  timestamp: string;
}

export interface TopicMastery {
  id: string;
  student_id: string;
  subject_id: string;
  chapter_id: string;
  topic: string;
  mastery_score: number; // 0 - 100 calculated from real signals
  mastery_state: MasteryStateLabel;
  questions_attempted: number;
  correct_answers: number;
  incorrect_answers: number;
  last_attempted_at: string;
  last_mastered_at?: string;
  difficulty_level: number; // 1 to 5
  consecutive_correct: number;
  consecutive_incorrect: number;
  status: TopicMasteryStatus;
  recent_history: TopicAttemptRecord[];
  next_review_at?: string;
  review_count: number;
  review_interval_days: number;
  updated_at: string;
}

export interface StudentLearningProfile {
  id: string;
  student_id: string;
  total_study_time_seconds: number;
  total_questions: number;
  total_correct: number;
  total_incorrect: number;
  overall_mastery: number; // 0 - 100
  current_streak: number;
  last_study_date: string; // YYYY-MM-DD
  preferred_difficulty: number; // 1 - 5
  daily_study_goal_minutes: number;
  priority_subjects: string[];
  updated_at: string;
}

export interface LearningSession {
  session_id: string;
  student_id: string;
  subject_id: string;
  subject_name: string;
  chapter_id: string;
  chapter_name: string;
  topic: string;
  mode: TutorMode;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  questions_attempted: number;
  correct_answers: number;
  incorrect_answers: number;
  starting_mastery: number;
  ending_mastery: number;
  starting_difficulty: number;
  ending_difficulty: number;
}

export interface DailyLearningRecord {
  date: string; // YYYY-MM-DD
  student_id: string;
  study_time_seconds: number;
  subjects_studied: string[];
  topics_studied: string[];
  questions_attempted: number;
  correct_answers: number;
  incorrect_answers: number;
}

export type AgentTeachingAction =
  | 'explain'
  | 'practice'
  | 'review'
  | 'quiz'
  | 'challenge'
  | 'revision'
  | 'next_topic';

export interface AgentDecision {
  teaching_action: AgentTeachingAction;
  topic: string;
  difficulty: number;
  reason: string;
  requires_answer: boolean;
  update_memory: boolean;
}

export interface PlanItem {
  id: string;
  title: string;
  type: 'review' | 'practice' | 'new_topic' | 'quiz';
  subject_id: string;
  subject_name: string;
  chapter_id: string;
  chapter_name: string;
  topic: string;
  estimated_minutes: number;
  reason: string;
  completed: boolean;
}

export interface ChapterLearningMemory {
  student_id: string;
  subject_id: string;
  chapter_id: string;
  topic: string;
  questions_attempted: number;
  correct_answers: number;
  incorrect_answers: number;
  mastery_score: number; // 0 - 100 calculated from real activity
  difficulty_level: number; // 1 = Basic, 2 = Easy, 3 = Medium, 4 = Challenging, 5 = Advanced
  last_interaction: string;
  common_mistakes: MistakeRecord[];
  mastered_concepts: string[];
  needs_practice: string[];
}

export interface QuizQuestionState {
  questionNumber: number; // 1 to 5
  question: string;
  difficulty: number;
  studentAnswer?: string;
  evaluation?: AnswerEvaluation;
  isAnswered: boolean;
}

export interface QuizSession {
  id: string;
  chapter_id: string;
  subject_id: string;
  currentQuestionIndex: number; // 0 to 4
  totalQuestions: number; // 5
  questions: QuizQuestionState[];
  score: number; // 0 to 5
  isCompleted: boolean;
  finalFeedback?: string;
}

