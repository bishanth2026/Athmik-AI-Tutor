import { apiFetch } from '../clientApi';
import {
  ChapterLearningMemory,
  MistakeRecord,
  StudentLearningProfile,
  TopicMastery,
  LearningSession,
  DailyLearningRecord,
  PlanItem,
  MistakeType,
} from '../types';

const STORAGE_KEYS = {
  MEMORY: 'athmik_learning_memory_v1',
  MISTAKES: 'athmik_mistake_records_v1',
  PROFILE: 'athmik_learning_profile_v1',
  SESSIONS: 'athmik_learning_sessions_v1',
  DAILY: 'athmik_daily_learning_v1',
};

export class ClientLearningMemoryService {
  // Synchronous cache for immediate UI rendering
  private memoryCache: ChapterLearningMemory[] = [];
  private mistakesCache: MistakeRecord[] = [];

  constructor() {
    this.loadLocalCache();
  }

  private loadLocalCache(): void {
    try {
      const memData = localStorage.getItem(STORAGE_KEYS.MEMORY);
      this.memoryCache = memData ? JSON.parse(memData) : [];
      const misData = localStorage.getItem(STORAGE_KEYS.MISTAKES);
      this.mistakesCache = misData ? JSON.parse(misData) : [];
    } catch (err) {
      console.error('Failed to load local learning cache', err);
    }
  }

  // ==============================================================================
  // 1. STUDENT LEARNING PROFILE (Section 3 & 35: Server backed + Local cached)
  // ==============================================================================

  public async getStudentProfile(studentId: string): Promise<StudentLearningProfile> {
    try {
      const res = await apiFetch(`/api/student/${studentId}/profile`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(json.data));
          return json.data;
        }
      }
    } catch (err) {
      console.error('Failed to fetch student profile:', err);
      throw new Error('Learning profile could not be loaded from the server.');
    }

    throw new Error('Learning profile could not be loaded from the server.');
  }

  public async updateParentSettings(
    studentId: string,
    settings: {
      daily_study_goal_minutes?: number;
      preferred_difficulty?: number;
      priority_subjects?: string[];
    }
  ): Promise<StudentLearningProfile | null> {
    try {
      const res = await apiFetch(`/api/student/${studentId}/parent-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(json.data));
          return json.data;
        }
      }
    } catch (err) {
      console.error('Failed to update parent settings:', err);
    }
    return null;
  }

  // ==============================================================================
  // 2. TOPIC MASTERY (Section 4, 5, 6)
  // ==============================================================================

  public async getAllTopicMasteries(studentId: string): Promise<TopicMastery[]> {
    try {
      const res = await apiFetch(`/api/student/${studentId}/mastery`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('Failed to fetch topic masteries:', err);
      throw new Error('Topic mastery could not be loaded from the server.');
    }
    throw new Error('Topic mastery could not be loaded from the server.');
  }

  // Backwards compatible sync getter for ChapterLearningMemory
  public getChapterMemory(
    studentId: string,
    subjectId: string,
    chapterId: string,
    topicName = ''
  ): ChapterLearningMemory {
    this.loadLocalCache();
    const existing = this.memoryCache.find(
      (m) => m.student_id === studentId && m.chapter_id === chapterId
    );

    if (existing) {
      return existing;
    }

    const newMemory: ChapterLearningMemory = {
      student_id: studentId,
      subject_id: subjectId,
      chapter_id: chapterId,
      topic: topicName,
      questions_attempted: 0,
      correct_answers: 0,
      incorrect_answers: 0,
      mastery_score: 0,
      difficulty_level: 2,
      last_interaction: new Date().toISOString(),
      common_mistakes: [],
      mastered_concepts: [],
      needs_practice: [],
    };

    this.memoryCache.push(newMemory);
    localStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(this.memoryCache));
    return newMemory;
  }

  // ==============================================================================
  // 3. MISTAKE MEMORY (Section 7, 8, 9)
  // ==============================================================================

  public async getMistakes(
    studentId: string,
    filter?: { chapter_id?: string; resolved?: boolean }
  ): Promise<MistakeRecord[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.chapter_id) params.append('chapter_id', filter.chapter_id);
      if (filter?.resolved !== undefined) params.append('resolved', String(filter.resolved));

      const res = await apiFetch(`/api/student/${studentId}/mistakes?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('Failed to fetch student mistakes:', err);
      throw new Error('Mistake history could not be loaded from the server.');
    }
    throw new Error('Mistake history could not be loaded from the server.');
  }

  // ==============================================================================
  // 4. ATTEMPT & PROGRESS CYCLES (Section 10, 11, 18, 40)
  // ==============================================================================

  public async recordQuestionAttempt(
    studentId: string,
    subjectId: string,
    chapterId: string,
    topic: string,
    status: 'correct' | 'partially_correct' | 'incorrect' | 'unclear',
    mistake?: { type: string; description: string } | null,
    conceptUnderstood?: string | null,
    questionText?: string,
    studentAnswer?: string
  ): Promise<ChapterLearningMemory> {
    const memory = this.getChapterMemory(studentId, subjectId, chapterId, topic);

    if (status === 'unclear') {
      return memory;
    }

    // Call server endpoint to record real attempt with multi-signal calculation
    try {
      const clientAttemptId = `${studentId}_${chapterId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res = await apiFetch(`/api/student/${studentId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_attempt_id: clientAttemptId,
          subject_id: subjectId,
          chapter_id: chapterId,
          topic,
          question: questionText,
          student_answer: studentAnswer,
          status,
          mistake_type: mistake?.type,
          mistake_description: mistake?.description,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const { mastery } = json.data;
          memory.questions_attempted = mastery.questions_attempted;
          memory.correct_answers = mastery.correct_answers;
          memory.incorrect_answers = mastery.incorrect_answers;
          memory.mastery_score = mastery.mastery_score;
          memory.difficulty_level = mastery.difficulty_level;
          memory.last_interaction = mastery.last_attempted_at;
        }
      }
    } catch (err) {
      console.error('[LearningMemory] Server attempt failed; local cache was not promoted to authority:', err);
      throw new Error('Learning attempt could not be saved. Please try again.');
    }

    if (conceptUnderstood && !memory.mastered_concepts.includes(conceptUnderstood)) {
      memory.mastered_concepts.push(conceptUnderstood);
    }

    // Save updated memory locally
    const idx = this.memoryCache.findIndex((m) => m.student_id === studentId && m.chapter_id === chapterId);
    if (idx >= 0) this.memoryCache[idx] = memory;
    else this.memoryCache.push(memory);
    localStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(this.memoryCache));

    // Progress is derived server-side from durable learning state. Do not write a second local authority.

    return memory;
  }

  // ==============================================================================
  // 5. SESSION & DAILY PLAN (Section 20 & 30)
  // ==============================================================================

  public async recordCompletedSession(session: Omit<LearningSession, 'session_id'>): Promise<void> {
    try {
      const res = await apiFetch(`/api/student/${session.student_id}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
      if (!res.ok) throw new Error(`Session save failed (${res.status})`);
    } catch (err) {
      console.error('Failed to sync session to server:', err);
      throw new Error('Learning session could not be saved.');
    }
  }

  public async getDailyLearningPlan(studentId: string): Promise<PlanItem[]> {
    try {
      const res = await apiFetch(`/api/student/${studentId}/plan`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {}

    throw new Error('Daily learning plan could not be loaded from the server.');
  }

  public async getParentReport(studentId: string): Promise<any> {
    try {
      const res = await apiFetch(`/api/student/${studentId}/parent-report`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('Failed to fetch parent report:', err);
    }
    return null;
  }
}

export const learningMemoryService = new ClientLearningMemoryService();
