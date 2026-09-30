import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  StudentLearningProfile,
  TopicMastery,
  MistakeRecord,
  MistakeType,
  LearningSession,
  DailyLearningRecord,
  MasteryStateLabel,
  TopicMasteryStatus,
  AgentDecision,
  AgentTeachingAction,
  PlanItem,
} from '../types';
import { INITIAL_SUBJECTS, INITIAL_CHAPTERS } from '../db/initialData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const PROFILES_FILE = path.join(DATA_DIR, 'student_learning_profiles.json');
const MASTERIES_FILE = path.join(DATA_DIR, 'topic_masteries.json');
const MISTAKES_FILE = path.join(DATA_DIR, 'mistake_records.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'learning_sessions.json');
const DAILY_FILE = path.join(DATA_DIR, 'daily_learning_records.json');
const FINGERPRINTS_FILE = path.join(DATA_DIR, 'question_fingerprints.json');
const ACTIVE_QUESTIONS_FILE = path.join(DATA_DIR, 'active_questions.json');

export class StudentLearningMemoryService {
  private profiles: StudentLearningProfile[] = [];
  private masteries: TopicMastery[] = [];
  private mistakes: MistakeRecord[] = [];
  private sessions: LearningSession[] = [];
  private dailyRecords: DailyLearningRecord[] = [];
  private questionFingerprints: { student_id: string; chapter_id: string; question: string; timestamp: string }[] = [];
  private activeQuestions: { id: string; student_id: string; subject_id: string; chapter_id?: string; topic: string; question: string; created_at: string }[] = [];

  constructor() {
    this.ensureDataStorage();
  }

  private ensureDataStorage(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.profiles = this.loadFile<StudentLearningProfile[]>(PROFILES_FILE, []);
    this.masteries = this.loadFile<TopicMastery[]>(MASTERIES_FILE, []);
    this.mistakes = this.loadFile<MistakeRecord[]>(MISTAKES_FILE, []);
    this.sessions = this.loadFile<LearningSession[]>(SESSIONS_FILE, []);
    this.dailyRecords = this.loadFile<DailyLearningRecord[]>(DAILY_FILE, []);
    this.questionFingerprints = this.loadFile<{ student_id: string; chapter_id: string; question: string; timestamp: string }[]>(FINGERPRINTS_FILE, []);
    this.activeQuestions = this.loadFile<typeof this.activeQuestions>(ACTIVE_QUESTIONS_FILE, []);
  }

  private loadFile<T>(filePath: string, defaultVal: T): T {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error(`[LearningMemory] Failed to read ${filePath}:`, err);
      }
    }
    return defaultVal;
  }

  private saveFile(filePath: string, data: any): void {
    const tempPath = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      console.error(`[LearningMemory] Failed to write ${filePath}:`, err);
      throw new Error('LEARNING_MEMORY_WRITE_FAILED');
    }
  }

  /** Replace the local mirror with verified durable data from Supabase. */
  public hydrateFromSupabase(snapshot: {
    studentId: string;
    profile?: StudentLearningProfile;
    masteries?: TopicMastery[];
    mistakes?: MistakeRecord[];
    activeQuestion?: { id: string; student_id: string; subject_id: string; chapter_id?: string; topic: string; question: string; created_at: string } | null;
  }): void {
    if (snapshot.profile) {
      this.profiles = this.profiles.filter((p) => p.student_id !== snapshot.studentId);
      this.profiles.push(snapshot.profile);
      this.saveFile(PROFILES_FILE, this.profiles);
    }
    if (snapshot.masteries) {
      this.masteries = this.masteries.filter((m) => m.student_id !== snapshot.studentId);
      this.masteries.push(...snapshot.masteries);
      this.saveFile(MASTERIES_FILE, this.masteries);
    }
    if (snapshot.mistakes) {
      this.mistakes = this.mistakes.filter((m) => m.student_id !== snapshot.studentId);
      this.mistakes.push(...snapshot.mistakes);
      this.saveFile(MISTAKES_FILE, this.mistakes);
    }
    this.activeQuestions = this.activeQuestions.filter((q) => q.student_id !== snapshot.studentId);
    if (snapshot.activeQuestion) this.activeQuestions.push(snapshot.activeQuestion);
    this.saveFile(ACTIVE_QUESTIONS_FILE, this.activeQuestions);
  }

  public setActiveQuestion(params: {
    student_id: string;
    subject_id: string;
    chapter_id?: string;
    topic: string;
    question: string;
  }): string {
    const id = `question_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = { id, ...params, created_at: new Date().toISOString() };
    this.activeQuestions = this.activeQuestions.filter((q) => q.student_id !== params.student_id);
    this.activeQuestions.push(entry);
    this.saveFile(ACTIVE_QUESTIONS_FILE, this.activeQuestions);
    return id;
  }

  public getActiveQuestion(studentId: string) {
    return this.activeQuestions.find((q) => q.student_id === studentId) || null;
  }

  public clearActiveQuestion(studentId: string, questionId?: string): void {
    this.activeQuestions = this.activeQuestions.filter((q) => q.student_id !== studentId || (questionId && q.id !== questionId));
    this.saveFile(ACTIVE_QUESTIONS_FILE, this.activeQuestions);
  }

  // ==============================================================================
  // 1. STUDENT LEARNING PROFILE (Section 3 & 41: No fake data, actual stats)
  // ==============================================================================

  public getProfile(studentId: string): StudentLearningProfile {
    let profile = this.profiles.find((p) => p.student_id === studentId);
    if (!profile) {
      const now = new Date().toISOString();
      profile = {
        id: `profile_${studentId}`,
        student_id: studentId,
        total_study_time_seconds: 0,
        total_questions: 0,
        total_correct: 0,
        total_incorrect: 0,
        overall_mastery: 0,
        current_streak: 0,
        last_study_date: '',
        preferred_difficulty: 2, // Default Easy/Class 5
        daily_study_goal_minutes: 20,
        priority_subjects: ['sub_maths', 'sub_science'],
        updated_at: now,
      };
      this.profiles.push(profile);
      this.saveFile(PROFILES_FILE, this.profiles);
    }
    return profile;
  }

  public updateProfileSettings(
    studentId: string,
    settings: {
      daily_study_goal_minutes?: number;
      preferred_difficulty?: number;
      priority_subjects?: string[];
    }
  ): StudentLearningProfile {
    const profile = this.getProfile(studentId);
    if (settings.daily_study_goal_minutes !== undefined) {
      profile.daily_study_goal_minutes = Math.max(5, Math.min(120, settings.daily_study_goal_minutes));
    }
    if (settings.preferred_difficulty !== undefined) {
      profile.preferred_difficulty = Math.max(1, Math.min(5, settings.preferred_difficulty));
    }
    if (settings.priority_subjects) {
      profile.priority_subjects = settings.priority_subjects;
    }
    profile.updated_at = new Date().toISOString();
    this.saveFile(PROFILES_FILE, this.profiles);
    return profile;
  }

  // ==============================================================================
  // 2. TOPIC MASTERY & SCORING (Section 4, 5, 6: Multi-Signal Model)
  // ==============================================================================

  public getTopicMastery(
    studentId: string,
    subjectId: string,
    chapterId: string,
    topicName: string
  ): TopicMastery {
    const normalizedTopic = (topicName || 'General Topic').trim();
    let mastery = this.masteries.find(
      (m) =>
        m.student_id === studentId &&
        m.chapter_id === chapterId &&
        m.topic.toLowerCase() === normalizedTopic.toLowerCase()
    );

    if (!mastery) {
      const now = new Date().toISOString();
      mastery = {
        id: `tm_${studentId}_${chapterId}_${Math.random().toString(36).substring(2, 7)}`,
        student_id: studentId,
        subject_id: subjectId,
        chapter_id: chapterId,
        topic: normalizedTopic,
        mastery_score: 0,
        mastery_state: 'foundational',
        questions_attempted: 0,
        correct_answers: 0,
        incorrect_answers: 0,
        last_attempted_at: now,
        difficulty_level: 2, // Initial Class 5 default
        consecutive_correct: 0,
        consecutive_incorrect: 0,
        status: 'not_started',
        recent_history: [],
        review_count: 0,
        review_interval_days: 1,
        updated_at: now,
      };
      this.masteries.push(mastery);
      this.saveFile(MASTERIES_FILE, this.masteries);
    }

    return mastery;
  }

  public getAllMasteriesForStudent(studentId: string): TopicMastery[] {
    return this.masteries.filter((m) => m.student_id === studentId);
  }

  /**
   * Section 5 & 6: Multi-signal Mastery Calculation
   * Recent performance: 40% (last 5 attempts)
   * Overall performance: 30% (total correct / total attempted)
   * Difficulty performance: 20% (difficulty_level / 5 * 100)
   * Consistency: 10% (penalized by repeated unresolved mistakes, scaled by volume)
   */
  public calculateMasteryScore(
    mastery: TopicMastery,
    unresolvedMistakeCount = 0
  ): { score: number; state: MasteryStateLabel; status: TopicMasteryStatus } {
    if (mastery.questions_attempted === 0) {
      return { score: 0, state: 'foundational', status: 'not_started' };
    }

    // 1. Recent accuracy (last 5 attempts)
    const recent = mastery.recent_history.slice(-5);
    const recentCorrect = recent.filter((r) => r.correct).length;
    const recentAccuracy = recent.length > 0 ? (recentCorrect / recent.length) * 100 : 0;

    // 2. Overall accuracy
    const overallAccuracy = (mastery.correct_answers / mastery.questions_attempted) * 100;

    // 3. Difficulty performance
    const difficultyPerformance = (mastery.difficulty_level / 5) * 100;

    // 4. Consistency & Mistake Impact
    const volumeFactor = Math.min(1.0, mastery.questions_attempted / 4);
    const mistakePenalty = Math.min(50, unresolvedMistakeCount * 15);
    const consistencyScore = Math.max(0, 100 - mistakePenalty);

    // Weighted composite formula:
    // Recent 40%, Overall 30%, Difficulty 20%, Consistency 10%
    const rawScore =
      recentAccuracy * 0.4 +
      overallAccuracy * 0.3 +
      difficultyPerformance * 0.2 +
      (consistencyScore * volumeFactor) * 0.1;

    // Scale by volume if student has only answered 1 or 2 questions
    const finalScore = Math.min(100, Math.max(0, Math.round(rawScore * volumeFactor)));

    // Section 6: Mastery Interpretation
    let state: MasteryStateLabel = 'foundational';
    if (finalScore >= 90) state = 'mastered';
    else if (finalScore >= 80) state = 'strong';
    else if (finalScore >= 60) state = 'practising';
    else if (finalScore >= 40) state = 'developing';
    else state = 'foundational';

    // Status mapping
    let status: TopicMasteryStatus = 'learning';
    if (finalScore >= 85 && mastery.questions_attempted >= 3) {
      status = 'mastered';
    } else if (finalScore < 50 || unresolvedMistakeCount > 0) {
      status = 'needs_practice';
    } else {
      status = 'learning';
    }

    return { score: finalScore, state, status };
  }

  // ==============================================================================
  // 3. MISTAKE MEMORY & RESOLUTION (Section 7, 8, 9)
  // ==============================================================================

  public getMistakesForStudent(
    studentId: string,
    filter?: { subject_id?: string; chapter_id?: string; resolved?: boolean }
  ): MistakeRecord[] {
    return this.mistakes.filter((m) => {
      if (m.student_id !== studentId) return false;
      if (filter?.subject_id && m.subject_id !== filter.subject_id) return false;
      if (filter?.chapter_id && m.chapter_id !== filter.chapter_id) return false;
      if (filter?.resolved !== undefined && m.resolved !== filter.resolved) return false;
      return true;
    });
  }

  public recordMistake(params: {
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
  }): MistakeRecord {
    const now = new Date().toISOString();
    const existing = this.mistakes.find(
      (m) =>
        m.student_id === params.student_id &&
        m.chapter_id === params.chapter_id &&
        m.mistake_type === params.mistake_type &&
        !m.resolved
    );

    if (existing) {
      existing.frequency += 1;
      existing.last_seen_at = now;
      existing.correct_since_mistake = 0; // reset evidence counter on repeat
      existing.resolved = false;
      if (params.question) existing.question = params.question;
      if (params.student_answer) existing.student_answer = params.student_answer;
      if (params.expected_answer) existing.expected_answer = params.expected_answer;
      if (params.description) existing.description = params.description;
      if (params.explanation) existing.explanation = params.explanation;
      existing.updated_at = now;
      this.saveFile(MISTAKES_FILE, this.mistakes);
      return existing;
    }

    const newMistake: MistakeRecord = {
      id: `mistake_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      student_id: params.student_id,
      subject_id: params.subject_id,
      chapter_id: params.chapter_id,
      topic: params.topic,
      question: params.question,
      student_answer: params.student_answer,
      expected_answer: params.expected_answer,
      mistake_type: params.mistake_type || 'conceptual',
      description: params.description,
      explanation: params.explanation,
      frequency: 1,
      first_seen_at: now,
      last_seen_at: now,
      correct_since_mistake: 0,
      resolved: false,
      updated_at: now,
    };

    this.mistakes.unshift(newMistake);
    this.saveFile(MISTAKES_FILE, this.mistakes);
    return newMistake;
  }

  /**
   * Section 9: Mistake Resolution
   * Requires evidence of improvement: 2 or more correct responses across appropriate questions
   */
  public evaluateMistakeResolutionOnCorrectAnswer(
    studentId: string,
    chapterId: string,
    topic: string
  ): MistakeRecord[] {
    const activeMistakes = this.mistakes.filter(
      (m) => m.student_id === studentId && m.chapter_id === chapterId && m.topic === topic && !m.resolved
    );

    const now = new Date().toISOString();
    for (const m of activeMistakes) {
      m.correct_since_mistake += 1;
      // High frequency mistakes require 3 consecutive correct; regular require 2
      const requiredCorrect = m.frequency >= 3 ? 3 : 2;
      if (m.correct_since_mistake >= requiredCorrect) {
        m.resolved = true;
        m.updated_at = now;
      }
    }

    this.saveFile(MISTAKES_FILE, this.mistakes);
    return activeMistakes;
  }

  // ==============================================================================
  // 4. QUESTION ATTEMPT CYCLE & ADAPTIVE DIFFICULTY (Section 10, 11)
  // ==============================================================================

  public recordQuestionAttempt(params: {
    student_id: string;
    subject_id: string;
    chapter_id: string;
    topic: string;
    question?: string;
    student_answer?: string;
    expected_answer?: string;
    status: 'correct' | 'partially_correct' | 'incorrect' | 'unclear';
    mistake_type?: MistakeType;
    mistake_description?: string;
    mistake_explanation?: string;
  }): {
    mastery: TopicMastery;
    profile: StudentLearningProfile;
    mistakeRecorded?: MistakeRecord;
    adaptiveDifficultyDelta: number;
    decision: AgentDecision;
  } {
    const mastery = this.getTopicMastery(
      params.student_id,
      params.subject_id,
      params.chapter_id,
      params.topic
    );
    const profile = this.getProfile(params.student_id);
    const now = new Date().toISOString();

    if (params.status === 'unclear') {
      return {
        mastery,
        profile,
        adaptiveDifficultyDelta: 0,
        decision: {
          teaching_action: 'explain',
          topic: mastery.topic,
          difficulty: mastery.difficulty_level,
          reason: 'Awaiting student clarification',
          requires_answer: true,
          update_memory: false,
        },
      };
    }

    mastery.questions_attempted += 1;
    mastery.last_attempted_at = now;
    profile.total_questions += 1;

    let isCorrect = false;
    let difficultyDelta = 0;
    let recordedMistake: MistakeRecord | undefined;

    if (params.status === 'correct') {
      isCorrect = true;
      mastery.correct_answers += 1;
      profile.total_correct += 1;
      mastery.consecutive_correct += 1;
      mastery.consecutive_incorrect = 0;

      // Section 11: 3 consecutive correct -> increase difficulty by 1
      if (mastery.consecutive_correct >= 3 && mastery.difficulty_level < 5) {
        mastery.difficulty_level += 1;
        mastery.consecutive_correct = 0;
        difficultyDelta = +1;
      }

      // Check if any previous mistakes can be resolved
      this.evaluateMistakeResolutionOnCorrectAnswer(
        params.student_id,
        params.chapter_id,
        params.topic
      );
    } else if (params.status === 'partially_correct') {
      // Half credit
      mastery.correct_answers += 0.5;
      profile.total_correct += 0.5;
      mastery.consecutive_correct = 0;
      mastery.consecutive_incorrect = 0;
    } else if (params.status === 'incorrect') {
      mastery.incorrect_answers += 1;
      profile.total_incorrect += 1;
      mastery.consecutive_incorrect += 1;
      mastery.consecutive_correct = 0;

      // Section 11: 2 consecutive incorrect -> decrease difficulty by 1
      if (mastery.consecutive_incorrect >= 2 && mastery.difficulty_level > 1) {
        mastery.difficulty_level -= 1;
        mastery.consecutive_incorrect = 0;
        difficultyDelta = -1;
      }

      // Record mistake
      if (params.mistake_description || params.mistake_type) {
        recordedMistake = this.recordMistake({
          student_id: params.student_id,
          subject_id: params.subject_id,
          chapter_id: params.chapter_id,
          topic: params.topic,
          question: params.question,
          student_answer: params.student_answer,
          expected_answer: params.expected_answer,
          mistake_type: params.mistake_type || 'calculation',
          description: params.mistake_description || 'Calculation difficulty',
          explanation: params.mistake_explanation,
        });
      }
    }

    // Append to recent history (sliding window of 10)
    mastery.recent_history.push({
      correct: isCorrect,
      difficulty: mastery.difficulty_level,
      timestamp: now,
    });
    if (mastery.recent_history.length > 10) {
      mastery.recent_history.shift();
    }

    // Recalculate multi-signal mastery score
    const unresolvedMistakes = this.getMistakesForStudent(params.student_id, {
      chapter_id: params.chapter_id,
      resolved: false,
    });
    const calculated = this.calculateMasteryScore(mastery, unresolvedMistakes.length);
    mastery.mastery_score = calculated.score;
    mastery.mastery_state = calculated.state;
    mastery.status = calculated.status;
    if (calculated.status === 'mastered') {
      mastery.last_mastered_at = now;
      // Section 29: Schedule spaced revision
      mastery.review_interval_days = mastery.review_count === 0 ? 1 : mastery.review_interval_days * 2;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + mastery.review_interval_days);
      mastery.next_review_at = nextDate.toISOString();
      mastery.review_count += 1;
    }
    mastery.updated_at = now;

    // Recalculate profile overall mastery
    const studentMasteries = this.getAllMasteriesForStudent(params.student_id);
    const sumMasteries = studentMasteries.reduce((sum, m) => sum + m.mastery_score, 0);
    profile.overall_mastery = studentMasteries.length > 0 ? Math.round(sumMasteries / studentMasteries.length) : 0;
    profile.updated_at = now;

    // Daily record update for streak & study tracking
    this.recordDailyActivity(params.student_id, params.subject_id, params.topic, isCorrect);

    this.saveFile(MASTERIES_FILE, this.masteries);
    this.saveFile(PROFILES_FILE, this.profiles);

    // Section 17: Structured Decision Object
    let teachingAction: AgentTeachingAction = 'practice';
    let actionReason = 'Continue standard practice';

    if (mastery.mastery_score < 40) {
      teachingAction = 'explain';
      actionReason = 'Foundational mastery below 40%; switch to real-life example & simple step-by-step guidance.';
    } else if (unresolvedMistakes.length > 0 && unresolvedMistakes[0].frequency >= 2) {
      teachingAction = 'review';
      actionReason = `Repeated mistake detected (${unresolvedMistakes[0].mistake_type}); prioritize targeted review.`;
    } else if (mastery.mastery_score >= 85) {
      teachingAction = 'challenge';
      actionReason = 'High mastery achieved; provide advanced Class-5 application problem.';
    }

    return {
      mastery,
      profile,
      mistakeRecorded: recordedMistake,
      adaptiveDifficultyDelta: difficultyDelta,
      decision: {
        teaching_action: teachingAction,
        topic: mastery.topic,
        difficulty: mastery.difficulty_level,
        reason: actionReason,
        requires_answer: true,
        update_memory: true,
      },
    };
  }

  // ==============================================================================
  // 5. DAILY ACTIVITY & STREAK (Section 21 & 22: Only count real activity)
  // ==============================================================================

  private recordDailyActivity(
    studentId: string,
    subjectId: string,
    topic: string,
    isCorrect: boolean
  ): void {
    const today = new Date().toISOString().split('T')[0];
    let daily = this.dailyRecords.find((d) => d.student_id === studentId && d.date === today);

    if (!daily) {
      daily = {
        date: today,
        student_id: studentId,
        study_time_seconds: 0,
        subjects_studied: [subjectId],
        topics_studied: [topic],
        questions_attempted: 1,
        correct_answers: isCorrect ? 1 : 0,
        incorrect_answers: isCorrect ? 0 : 1,
      };
      this.dailyRecords.push(daily);
    } else {
      daily.questions_attempted += 1;
      if (isCorrect) daily.correct_answers += 1;
      else daily.incorrect_answers += 1;
      if (!daily.subjects_studied.includes(subjectId)) daily.subjects_studied.push(subjectId);
      if (!daily.topics_studied.includes(topic)) daily.topics_studied.push(topic);
    }

    // Update real streak
    const profile = this.getProfile(studentId);
    profile.last_study_date = today;
    profile.current_streak = this.calculateRealStreak(studentId);

    this.saveFile(DAILY_FILE, this.dailyRecords);
  }

  public calculateRealStreak(studentId: string): number {
    const activeDays = this.dailyRecords
      .filter((d) => d.student_id === studentId && d.questions_attempted > 0)
      .map((d) => d.date)
      .sort()
      .reverse();

    if (activeDays.length === 0) return 0;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Must have activity today or yesterday to maintain active streak
    if (!activeDays.includes(todayStr) && !activeDays.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    let checkDate = new Date(activeDays[0]);

    for (const dayStr of activeDays) {
      const d = new Date(dayStr);
      const diffDays = Math.round((checkDate.getTime() - d.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= 1) {
        streak += 1;
        checkDate = d;
      } else {
        break;
      }
    }

    return streak;
  }

  // ==============================================================================
  // 6. LEARNING SESSIONS (Section 20)
  // ==============================================================================

  public recordSession(sessionData: Omit<LearningSession, 'session_id'>): LearningSession {
    const session: LearningSession = {
      ...sessionData,
      session_id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    this.sessions.unshift(session);

    // Update profile study time
    const profile = this.getProfile(session.student_id);
    profile.total_study_time_seconds += session.duration_seconds;
    this.saveFile(SESSIONS_FILE, this.sessions);
    this.saveFile(PROFILES_FILE, this.profiles);

    // Update daily study time
    const today = session.started_at.split('T')[0];
    const daily = this.dailyRecords.find((d) => d.student_id === session.student_id && d.date === today);
    if (daily) {
      daily.study_time_seconds += session.duration_seconds;
      this.saveFile(DAILY_FILE, this.dailyRecords);
    }

    return session;
  }

  public getSessionsForStudent(studentId: string, limit = 10): LearningSession[] {
    return this.sessions.filter((s) => s.student_id === studentId).slice(0, limit);
  }

  // ==============================================================================
  // 7. QUESTION DIVERSITY & FINGERPRINTING (Section 13)
  // ==============================================================================

  public recordQuestionFingerprint(studentId: string, chapterId: string, question: string): void {
    const normalized = question.toLowerCase().replace(/[^\w\s]/g, '').trim();
    this.questionFingerprints.unshift({
      student_id: studentId,
      chapter_id: chapterId,
      question: normalized,
      timestamp: new Date().toISOString(),
    });
    // Keep last 30 questions
    if (this.questionFingerprints.length > 30) {
      this.questionFingerprints.pop();
    }
    this.saveFile(FINGERPRINTS_FILE, this.questionFingerprints);
  }

  public getRecentQuestionsForChapter(studentId: string, chapterId: string): string[] {
    return this.questionFingerprints
      .filter((q) => q.student_id === studentId && q.chapter_id === chapterId)
      .slice(0, 10)
      .map((q) => q.question);
  }

  // ==============================================================================
  // 8. TODAY'S LEARNING PLAN (Section 30)
  // ==============================================================================

  public generateDailyLearningPlan(studentId: string): PlanItem[] {
    const profile = this.getProfile(studentId);
    const masteries = this.getAllMasteriesForStudent(studentId);
    const unresolvedMistakes = this.getMistakesForStudent(studentId, { resolved: false });
    const now = new Date();
    const plan: PlanItem[] = [];

    const curriculum = this.getCurriculumMetadata();
    const metadataFor = (subjectId: string, chapterId: string) => ({
      subject_name: curriculum.subjects.get(subjectId) || subjectId,
      chapter_name: curriculum.chapters.get(chapterId) || chapterId,
    });

    // Priority 1: unresolved mistakes, then weakest evidenced topic.
    const weakTopic = [...masteries]
      .filter((m) => m.questions_attempted > 0)
      .sort((a, b) => a.mastery_score - b.mastery_score)[0];
    const target: MistakeRecord | TopicMastery | undefined = unresolvedMistakes[0] ?? weakTopic;
    if (target) {
      const targetRecord = target as MistakeRecord & Partial<TopicMastery>;
      const isMistake = 'mistake_type' in target;
      const meta = metadataFor(targetRecord.subject_id, targetRecord.chapter_id);
      plan.push({
        id: isMistake ? `plan_mistake_${targetRecord.id}` : `plan_weak_${targetRecord.id}`,
        title: isMistake
          ? `Review ${targetRecord.mistake_type} Mistake: ${targetRecord.topic}`
          : `Practice Weak Topic: ${targetRecord.topic}`,
        type: isMistake ? 'review' : 'practice',
        subject_id: targetRecord.subject_id,
        subject_name: meta.subject_name,
        chapter_id: targetRecord.chapter_id,
        chapter_name: meta.chapter_name,
        topic: targetRecord.topic,
        estimated_minutes: isMistake ? 10 : 15,
        reason: isMistake
          ? `Repeated difficulty with ${targetRecord.description}. Targeted review scheduled.`
          : `Current mastery is ${targetRecord.mastery_score}% (${targetRecord.mastery_state}). Practice will strengthen understanding.`,
        completed: false,
      });
    }

    // Priority 2: one spaced-revision item due now.
    const dueRevision = masteries
      .filter((m) => m.next_review_at && new Date(m.next_review_at) <= now)
      .sort((a, b) => new Date(a.next_review_at!).getTime() - new Date(b.next_review_at!).getTime())[0];
    if (dueRevision) {
      const meta = metadataFor(dueRevision.subject_id, dueRevision.chapter_id);
      plan.push({
        id: `plan_rev_${dueRevision.id}`,
        title: `Spaced Revision: ${dueRevision.topic}`,
        type: 'review',
        subject_id: dueRevision.subject_id,
        subject_name: meta.subject_name,
        chapter_id: dueRevision.chapter_id,
        chapter_name: meta.chapter_name,
        topic: dueRevision.topic,
        estimated_minutes: 10,
        reason: `Review #${dueRevision.review_count + 1} scheduled based on spaced repetition.`,
        completed: false,
      });
    }

    // Priority 3: continue the student's existing learning context instead of hard-coded curriculum.
    const current = masteries
      .filter((m) => m.questions_attempted > 0)
      .sort((a, b) => new Date(b.last_attempted_at).getTime() - new Date(a.last_attempted_at).getTime())[0];
    if (current) {
      const meta = metadataFor(current.subject_id, current.chapter_id);
      plan.push({
        id: `plan_continue_${current.id}`,
        title: `Continue: ${current.topic}`,
        type: current.mastery_score < 70 ? 'practice' : 'review',
        subject_id: current.subject_id,
        subject_name: meta.subject_name,
        chapter_id: current.chapter_id,
        chapter_name: meta.chapter_name,
        topic: current.topic,
        estimated_minutes: 15,
        reason: `Continue from the most recently studied topic using the student's current mastery and difficulty.`,
        completed: false,
      });
    } else if (profile.priority_subjects.length > 0) {
      const subjectId = profile.priority_subjects[0];
      const chapter = curriculum.firstChapterBySubject.get(subjectId);
      if (chapter) {
        plan.push({
          id: `plan_start_${subjectId}_${chapter.id}`,
          title: `Start: ${chapter.name}`,
          type: 'new_topic',
          subject_id: subjectId,
          subject_name: curriculum.subjects.get(subjectId) || subjectId,
          chapter_id: chapter.id,
          chapter_name: chapter.name,
          topic: chapter.name,
          estimated_minutes: 15,
          reason: 'No prior learning activity exists yet; start with the first available chapter in a priority subject.',
          completed: false,
        });
      }
    }

    return plan;
  }

  private getCurriculumMetadata() {
    // Seed curriculum is metadata only; plan generation never invents subject/chapter names.
    const subjects = new Map<string, string>();
    const chapters = new Map<string, string>();
    const firstChapterBySubject = new Map<string, { id: string; name: string }>();
    try {
      const seed = { subjects: INITIAL_SUBJECTS, chapters: INITIAL_CHAPTERS };
      for (const subject of seed.subjects) subjects.set(subject.id, subject.name);
      for (const chapter of seed.chapters) {
        chapters.set(chapter.id, chapter.chapter_name);
        if (!firstChapterBySubject.has(chapter.subject_id)) firstChapterBySubject.set(chapter.subject_id, { id: chapter.id, name: chapter.chapter_name });
      }
    } catch (error) {
      console.warn('[LearningMemory] Curriculum metadata unavailable:', error);
    }
    return { subjects, chapters, firstChapterBySubject };
  }

  // ==============================================================================
  // 9. PARENT TOPIC REPORT (Section 24, 25, 26)
  // ==============================================================================

  public getParentLearningReport(studentId: string): {
    profile: StudentLearningProfile;
    strongTopics: TopicMastery[];
    weakTopics: TopicMastery[];
    allTopics: TopicMastery[];
    recentMistakes: MistakeRecord[];
    recentSessions: LearningSession[];
  } {
    const profile = this.getProfile(studentId);
    const masteries = this.getAllMasteriesForStudent(studentId);
    const mistakes = this.getMistakesForStudent(studentId);
    const sessions = this.getSessionsForStudent(studentId, 5);

    const strongTopics = masteries.filter((m) => m.mastery_score >= 80);
    const weakTopics = masteries.filter((m) => m.mastery_score < 60 && m.questions_attempted > 0);

    return {
      profile,
      strongTopics,
      weakTopics,
      allTopics: masteries,
      recentMistakes: mistakes.slice(0, 8),
      recentSessions: sessions,
    };
  }

  // ==============================================================================
  // 10. DETERMINISTIC EVALUATOR (Section 19: Do not trust AI for basic arithmetic)
  // ==============================================================================

  public evaluateDeterministicAnswer(
    question: string,
    studentAnswer: string
  ): { isDeterministic: boolean; isCorrect?: boolean; expectedValue?: string } {
    if (!studentAnswer || !question) return { isDeterministic: false };

    const qLower = question.toLowerCase();
    const aLower = studentAnswer.toLowerCase().trim();

    // Pattern 1: Floramma sells prawns at ₹150 for 1 kg, buys 2 kg (150 * 2 = 300)
    if (qLower.includes('floramma') && qLower.includes('prawn') && (qLower.includes('2 kg') || qLower.includes('2kg'))) {
      const match = aLower.match(/\b300\b/);
      return { isDeterministic: true, isCorrect: !!match, expectedValue: '₹300' };
    }

    // Pattern 2: Log boat travels 4 km in 1 hour, in 2 hours = 8 km
    if (qLower.includes('log boat') && qLower.includes('4') && (qLower.includes('2 hour') || qLower.includes('2 hours'))) {
      const match = aLower.match(/\b8\b/);
      return { isDeterministic: true, isCorrect: !!match, expectedValue: '8 km' };
    }

    // Pattern 3: Log boat travels 4 km in 1 hour, in 3 hours = 12 km
    if (qLower.includes('log boat') && qLower.includes('4') && (qLower.includes('3 hour') || qLower.includes('3 hours'))) {
      const match = aLower.match(/\b12\b/);
      return { isDeterministic: true, isCorrect: !!match, expectedValue: '12 km' };
    }

    // Pattern 4: Log boat 4 km in 1 hour, travel 10 km = 2.5 hours / 2 hours 30 mins
    if (qLower.includes('log boat') && qLower.includes('10 km')) {
      const match = aLower.includes('2.5') || aLower.includes('2 hours and 30') || aLower.includes('2 hours 30') || aLower.includes('2 and a half');
      return { isDeterministic: true, isCorrect: match, expectedValue: '2 hours and 30 minutes' };
    }

    // Pattern 5: Kingfish 8 kg for ₹1200, price per kg = 1200 / 8 = 150
    if (qLower.includes('kingfish') && (qLower.includes('1200') || qLower.includes('1,200')) && qLower.includes('8')) {
      const match = aLower.match(/\b150\b/);
      return { isDeterministic: true, isCorrect: !!match, expectedValue: '₹150 per kg' };
    }

    // Pattern 6: Motor boat 20 km in 1 hour, in 6 hours = 120 km
    if (qLower.includes('motor boat') && qLower.includes('20') && qLower.includes('6 hour')) {
      const match = aLower.match(/\b120\b/);
      return { isDeterministic: true, isCorrect: !!match, expectedValue: '120 km' };
    }

    // Pattern 7: 20 women save ₹25 each month = 20 * 25 = 500
    if (qLower.includes('20') && qLower.includes('25') && (qLower.includes('save') || qLower.includes('month') || qLower.includes('meenkar'))) {
      const match = aLower.match(/\b500\b/);
      return { isDeterministic: true, isCorrect: !!match, expectedValue: '₹500' };
    }

    return { isDeterministic: false };
  }
}

export const studentLearningMemory = new StudentLearningMemoryService();
