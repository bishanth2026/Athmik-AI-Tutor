import { SupabaseRestClient } from './supabaseRest.ts';
import { StudentLearningMemoryService } from './studentLearningMemory.ts';

interface StudentRow { id: string; legacy_id?: string; parent_id: string; name: string; }
interface SubjectRow { id: string; legacy_id?: string; }
interface ChapterRow { id: string; legacy_id?: string; subject_id: string; }

/**
 * Durable-memory bridge. Supabase is the authoritative store when configured;
 * the existing in-process service remains a local calculation/cache layer.
 */
export class SupabaseMemorySync {
  private readonly hydrationCache = new Map<string, number>();
  private readonly hydrationTtlMs = 30_000;

  constructor(private readonly db: SupabaseRestClient | null, private readonly local: StudentLearningMemoryService) {}

  get enabled() { return !!this.db; }

  private invalidateHydration(studentId: string) {
    this.hydrationCache.delete(studentId);
  }

  async hydrateStudent(studentId: string): Promise<void> {
    if (!this.db) return;
    const now = Date.now();
    const cachedAt = this.hydrationCache.get(studentId);
    if (cachedAt && now - cachedAt < this.hydrationTtlMs) return;
    try {
      const students = await this.db.select<StudentRow>('students', `select=id,legacy_id,parent_id,name&legacy_id=eq.${encodeURIComponent(studentId)}`) as StudentRow[];
      if (!students.length) return;
      const dbStudentId = students[0].id;
      const [profiles, masteries, mistakes, activeQuestions] = await Promise.all([
        this.db.select<any>('student_learning_profiles', `select=*&student_id=eq.${dbStudentId}`) as Promise<any[]>,
        this.db.select<any>('topic_masteries', `select=*&student_id=eq.${dbStudentId}`) as Promise<any[]>,
        this.db.select<any>('mistake_records', `select=*&student_id=eq.${dbStudentId}&order=last_seen_at.desc`) as Promise<any[]>,
        this.db.select<any>('tutor_questions', `select=*&student_id=eq.${dbStudentId}&answered_at=is.null&order=created_at.desc&limit=1`) as Promise<any[]>,
      ]);
      this.local.hydrateFromSupabase({
        studentId,
        profile: profiles[0] ? this.mapProfile(profiles[0], studentId) : undefined,
        masteries: await this.mapMasteries(masteries),
        mistakes: await this.mapMistakes(mistakes),
        activeQuestion: activeQuestions[0] ? await this.mapActiveQuestion(activeQuestions[0], studentId) : null,
      });
      this.hydrationCache.set(studentId, Date.now());
    } catch (error) {
      console.warn('[Supabase] Hydration failed; retaining local cache:', error);
    }
  }

  private mapProfile(row: any, studentId: string) {
    return {
      ...row,
      id: row.legacy_id || `profile_${studentId}`,
      student_id: studentId,
      priority_subjects: row.priority_subjects || [],
    };
  }

  async syncAttempt(studentId: string, attempt: any, mastery: any, mistake?: any, profile?: any): Promise<void> {
    if (!this.db) return;
    const payload = {
      student_id: studentId,
      client_attempt_id: attempt.client_attempt_id,
      attempt: {
        subject_id: attempt.subject_id,
        chapter_id: attempt.chapter_id,
        topic: attempt.topic,
        question: attempt.question || '',
        student_answer: attempt.student_answer || null,
        expected_answer: attempt.expected_answer || null,
        status: attempt.status,
        mistake_type: attempt.mistake_type || null,
        mistake_description: attempt.mistake_description || null,
        concept_understood: attempt.concept_understood || null,
      },
      mastery,
      mistake: mistake ? {
        ...mistake,
        topic: mistake.topic || attempt.topic,
        question: mistake.question || attempt.question || null,
        student_answer: mistake.student_answer || attempt.student_answer || null,
        expected_answer: mistake.expected_answer || attempt.expected_answer || null,
        mistake_type: mistake.mistake_type || mistake.type,
        description: mistake.description || mistake.mistake_description,
      } : null,
      profile: profile || {},
    };
    try {
      await this.db.rpc('record_learning_attempt_atomic', { payload });
      this.markHydrated(studentId);
    } catch (error) {
      console.error('[Supabase] Atomic attempt sync failed:', error);
      throw error;
    }
  }

  async syncProfile(studentId: string, profile: any): Promise<void> {
    if (!this.db) return;
    const students = await this.db.select<StudentRow>('students', `select=id&legacy_id=eq.${encodeURIComponent(studentId)}`) as StudentRow[];
    if (!students[0]) return;
    await this.db.upsert('student_learning_profiles', {
      student_id: students[0].id, total_study_time_seconds: profile.total_study_time_seconds,
      total_questions: profile.total_questions, total_correct: profile.total_correct,
      total_incorrect: profile.total_incorrect, overall_mastery: profile.overall_mastery,
      current_streak: profile.current_streak, last_study_date: profile.last_study_date || null,
      preferred_difficulty: profile.preferred_difficulty, daily_study_goal_minutes: profile.daily_study_goal_minutes,
      priority_subjects: profile.priority_subjects || [], updated_at: profile.updated_at,
    }, 'student_id');
    this.markHydrated(studentId);
  }

  async syncActiveQuestion(studentId: string, q: any | null): Promise<void> {
    if (!this.db) return;
    const students = await this.db.select<StudentRow>('students', `select=id&legacy_id=eq.${encodeURIComponent(studentId)}`) as StudentRow[];
    if (!students[0]) return;
    if (!q) {
      await this.db.update('tutor_questions', `student_id=eq.${students[0].id}&answered_at=is.null`, { answered_at: new Date().toISOString() });
      this.markHydrated(studentId);
      return;
    }
    const subjects = await this.db.select<SubjectRow>('subjects', `select=id&legacy_id=eq.${encodeURIComponent(q.subject_id)}`) as SubjectRow[];
    const chapters = q.chapter_id ? await this.db.select<ChapterRow>('chapters', `select=id&legacy_id=eq.${encodeURIComponent(q.chapter_id)}`) as ChapterRow[] : [];
    if (!subjects[0]) return;
    await this.db.update('tutor_questions', `student_id=eq.${students[0].id}&answered_at=is.null`, { answered_at: new Date().toISOString() });
    await this.db.upsert('tutor_questions', {
      legacy_id: q.id, student_id: students[0].id, subject_id: subjects[0].id,
      chapter_id: chapters[0]?.id || null, topic: q.topic, question_text: q.question,
      difficulty_level: 2, answer_type: 'open_ended', grading_method: 'ai', created_at: q.created_at,
    }, 'legacy_id');
    this.markHydrated(studentId);
  }
  async syncSession(session: any): Promise<void> {
    if (!this.db) return;
    const students = await this.db.select<StudentRow>('students', `select=id&legacy_id=eq.${encodeURIComponent(session.student_id)}`) as StudentRow[];
    if (!students[0]) return;
    const subjects = await this.db.select<SubjectRow>('subjects', `select=id&legacy_id=eq.${encodeURIComponent(session.subject_id)}`) as SubjectRow[];
    const chapters = session.chapter_id ? await this.db.select<ChapterRow>('chapters', `select=id&legacy_id=eq.${encodeURIComponent(session.chapter_id)}`) as ChapterRow[] : [];
    if (!subjects[0]) return;
    await this.db.upsert('learning_sessions', {
      legacy_id: session.session_id, student_id: students[0].id, subject_id: subjects[0].id,
      chapter_id: chapters[0]?.id || null, topic: session.topic || null, mode: session.mode || 'learn',
      started_at: session.started_at, ended_at: session.ended_at || null, duration_seconds: session.duration_seconds || 0,
      questions_attempted: session.questions_attempted || 0, correct_answers: session.correct_answers || 0,
      incorrect_answers: session.incorrect_answers || 0, starting_mastery: session.starting_mastery ?? null,
      ending_mastery: session.ending_mastery ?? null, starting_difficulty: session.starting_difficulty ?? null,
      ending_difficulty: session.ending_difficulty ?? null, updated_at: new Date().toISOString(),
    }, 'legacy_id');
    await this.syncProfile(session.student_id, this.local.getProfile(session.student_id));
  }

}
