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
  private readonly hydrationTtlMs = 60_000;
  private readonly hydrationInFlight = new Map<string, Promise<void>>();
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(private readonly db: SupabaseRestClient | null, private readonly local: StudentLearningMemoryService) {}

  get enabled() { return !!this.db; }

  private markHydrated(studentId: string) {
    this.hydrationCache.set(studentId, Date.now());
  }

  private enqueueWrite(studentId: string, task: () => Promise<void>) {
    const previous = this.writeQueues.get(studentId) || Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(task)
      .catch((error) => {
        console.error(`[Supabase] Background durable write failed for ${studentId}:`, error);
      })
      .finally(() => {
        if (this.writeQueues.get(studentId) === next) this.writeQueues.delete(studentId);
      });
    this.writeQueues.set(studentId, next);
  }

  async hydrateStudent(studentId: string): Promise<void> {
    if (!this.db) return;

    const cachedAt = this.hydrationCache.get(studentId);
    if (cachedAt && Date.now() - cachedAt < this.hydrationTtlMs) return;

    const existing = this.hydrationInFlight.get(studentId);
    if (existing) return existing;

    const work = this.hydrateStudentUncached(studentId);
    this.hydrationInFlight.set(studentId, work);
    try {
      await work;
    } finally {
      this.hydrationInFlight.delete(studentId);
    }
  }

  private async hydrateStudentUncached(studentId: string): Promise<void> {
    try {
      const students = await this.db!.select<StudentRow>(
        'students',
        'select=id,legacy_id,parent_id,name&legacy_id=eq.' + encodeURIComponent(studentId)
      ) as StudentRow[];
      if (!students.length) return;

      const dbStudentId = students[0].id;
      const [profiles, masteries, mistakes, activeQuestions] = await Promise.all([
        this.db!.select<any>('student_learning_profiles', 'select=*&student_id=eq.' + dbStudentId) as Promise<any[]>,
        this.db!.select<any>('topic_masteries', 'select=*&student_id=eq.' + dbStudentId) as Promise<any[]>,
        this.db!.select<any>('mistake_records', 'select=*&student_id=eq.' + dbStudentId + '&order=last_seen_at.desc') as Promise<any[]>,
        this.db!.select<any>('tutor_questions', 'select=*&student_id=eq.' + dbStudentId + '&answered_at=is.null&order=created_at.desc&limit=1') as Promise<any[]>,
      ]);

      // Previous implementation did 3 Supabase lookups per mastery and 3 per
      // mistake. Fetch foreign-key dictionaries once instead of N+1 queries.
      const subjectIds = [...new Set([
        ...masteries.map((r: any) => r.subject_id),
        ...mistakes.map((r: any) => r.subject_id),
        ...(activeQuestions[0]?.subject_id ? [activeQuestions[0].subject_id] : []),
      ].filter(Boolean))];

      const chapterIds = [...new Set([
        ...masteries.map((r: any) => r.chapter_id),
        ...mistakes.map((r: any) => r.chapter_id),
        ...(activeQuestions[0]?.chapter_id ? [activeQuestions[0].chapter_id] : []),
      ].filter(Boolean))];

      const [subjects, chapters] = await Promise.all([
        subjectIds.length
          ? this.db!.select<SubjectRow>('subjects', 'select=id,legacy_id&id=in.(' + subjectIds.map(encodeURIComponent).join(',') + ')') as Promise<SubjectRow[]>
          : Promise.resolve([] as SubjectRow[]),
        chapterIds.length
          ? this.db!.select<ChapterRow>('chapters', 'select=id,legacy_id&id=in.(' + chapterIds.map(encodeURIComponent).join(',') + ')') as Promise<ChapterRow[]>
          : Promise.resolve([] as ChapterRow[]),
      ]);

      const subjectMap = new Map(subjects.map((r) => [r.id, r.legacy_id || r.id]));
      const chapterMap = new Map(chapters.map((r) => [r.id, r.legacy_id || r.id]));

      const mapRows = (rows: any[]) => rows
        .filter((row) => row.student_id === dbStudentId)
        .map((row) => ({
          ...row,
          id: row.legacy_id || row.id,
          student_id: studentId,
          subject_id: subjectMap.get(row.subject_id) || row.subject_id,
          chapter_id: chapterMap.get(row.chapter_id) || row.chapter_id,
        }));

      const activeRow = activeQuestions[0];
      this.local.hydrateFromSupabase({
        studentId,
        profile: profiles[0] ? this.mapProfile(profiles[0], studentId) : undefined,
        masteries: mapRows(masteries),
        mistakes: mapRows(mistakes),
        activeQuestion: activeRow ? {
          id: activeRow.legacy_id || activeRow.id,
          student_id: studentId,
          subject_id: subjectMap.get(activeRow.subject_id) || activeRow.subject_id,
          chapter_id: activeRow.chapter_id ? (chapterMap.get(activeRow.chapter_id) || activeRow.chapter_id) : undefined,
          topic: activeRow.topic || '',
          question: activeRow.question_text,
          created_at: activeRow.created_at,
        } : null,
      });

      this.markHydrated(studentId);
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

  queueAttempt(studentId: string, attempt: any, mastery: any, mistake?: any, profile?: any): void {
    this.enqueueWrite(studentId, () => this.syncAttempt(studentId, attempt, mastery, mistake, profile));
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
  queueActiveQuestion(studentId: string, q: any | null): void {
    this.enqueueWrite(studentId, () => this.syncActiveQuestion(studentId, q));
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
