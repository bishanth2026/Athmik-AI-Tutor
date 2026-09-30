/**
 * One-time migration of the existing local JSON learning memory into Supabase.
 * Run only after applying the Phase 2 + Phase 3 SQL migrations.
 *
 * Usage: npx tsx scripts/migrateLocalDataToSupabase.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { SupabaseRestClient } from '../src/server/supabaseRest.ts';
import { INITIAL_PARENT, INITIAL_STUDENT, INITIAL_SUBJECTS, INITIAL_CHAPTERS } from '../src/db/initialData.ts';

const root = path.resolve(process.cwd());
const dataDir = path.join(root, 'data');
const db = new SupabaseRestClient();
const read = <T>(name: string, fallback: T): T => {
  const file = path.join(dataDir, name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
};

const parents = [INITIAL_PARENT];
const students = [INITIAL_STUDENT];
const subjects = INITIAL_SUBJECTS;
const chapters = INITIAL_CHAPTERS;
const profiles = read<any[]>('student_learning_profiles.json', []);
const masteries = read<any[]>('topic_masteries.json', []);
const mistakes = read<any[]>('mistake_records.json', []);
const sessions = read<any[]>('learning_sessions.json', []);
const daily = read<any[]>('daily_learning_records.json', []);
const activeQuestions = read<any[]>('active_questions.json', []);

async function upsertCore(table: string, rows: any[]) {
  if (!rows.length) return;
  await db.upsert(table, rows.map((r) => ({ ...r, legacy_id: r.id })), 'legacy_id');
  console.log(`Migrated ${rows.length} ${table} row(s)`);
}

async function resolve(table: string, legacyId: string) {
  const rows = await db.select<any>(table, `select=id&legacy_id=eq.${encodeURIComponent(legacyId)}`) as any[];
  if (!rows[0]) throw new Error(`Missing ${table} legacy_id=${legacyId}`);
  return rows[0].id;
}

async function main() {
  await upsertCore('parents', parents);
  await upsertCore('students', students);
  await upsertCore('subjects', subjects);
  await upsertCore('chapters', chapters);

  for (const p of profiles) {
    await db.upsert('student_learning_profiles', {
      legacy_id: p.id, student_id: await resolve('students', p.student_id),
      total_study_time_seconds: p.total_study_time_seconds || 0, total_questions: p.total_questions || 0,
      total_correct: p.total_correct || 0, total_incorrect: p.total_incorrect || 0,
      overall_mastery: p.overall_mastery || 0, current_streak: p.current_streak || 0,
      last_study_date: p.last_study_date || null, preferred_difficulty: p.preferred_difficulty || 2,
      daily_study_goal_minutes: p.daily_study_goal_minutes || 20, priority_subjects: p.priority_subjects || [],
      updated_at: p.updated_at || new Date().toISOString(),
    }, 'legacy_id');
  }

  for (const m of masteries) {
    await db.upsert('topic_masteries', {
      legacy_id: m.id, student_id: await resolve('students', m.student_id), subject_id: await resolve('subjects', m.subject_id),
      chapter_id: await resolve('chapters', m.chapter_id), topic: m.topic, mastery_score: m.mastery_score || 0,
      mastery_state: m.mastery_state || 'foundational', status: m.status || 'not_started',
      questions_attempted: m.questions_attempted || 0, correct_answers: m.correct_answers || 0,
      incorrect_answers: m.incorrect_answers || 0, difficulty_level: m.difficulty_level || 2,
      consecutive_correct: m.consecutive_correct || 0, consecutive_incorrect: m.consecutive_incorrect || 0,
      last_attempted_at: m.last_attempted_at || null, last_mastered_at: m.last_mastered_at || null,
      next_review_at: m.next_review_at || null, review_count: m.review_count || 0,
      review_interval_days: m.review_interval_days || 1, recent_history: m.recent_history || [], updated_at: m.updated_at || new Date().toISOString(),
    }, 'legacy_id');
  }

  for (const m of mistakes) {
    await db.upsert('mistake_records', {
      legacy_id: m.id, student_id: await resolve('students', m.student_id), subject_id: await resolve('subjects', m.subject_id),
      chapter_id: await resolve('chapters', m.chapter_id), topic: m.topic, question: m.question || null,
      student_answer: m.student_answer || null, expected_answer: m.expected_answer || null,
      mistake_type: m.mistake_type, description: m.description, explanation: m.explanation || null,
      frequency: m.frequency || 1, correct_since_mistake: m.correct_since_mistake || 0,
      resolved: !!m.resolved, first_seen_at: m.first_seen_at || new Date().toISOString(), last_seen_at: m.last_seen_at || new Date().toISOString(),
    }, 'legacy_id');
  }

  for (const q of activeQuestions) {
    await db.upsert('tutor_questions', {
      legacy_id: q.id, student_id: await resolve('students', q.student_id), subject_id: await resolve('subjects', q.subject_id),
      chapter_id: q.chapter_id ? await resolve('chapters', q.chapter_id) : null, topic: q.topic,
      question_text: q.question, difficulty_level: 2, answer_type: 'open_ended', grading_method: 'ai', created_at: q.created_at,
    }, 'legacy_id');
  }

  console.log('Migration completed. Attempts/sessions/daily records are intentionally migrated only when their source files exist and can be resolved.');
}

main().catch((error) => { console.error(error); process.exit(1); });
