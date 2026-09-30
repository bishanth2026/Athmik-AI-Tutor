-- Athmik AI Tutor - Production Foundation Migration
-- No user-facing features. This migration establishes the durable data model,
-- ownership boundaries, attempt history, active-question state, and vector storage.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- AUTH OWNERSHIP
-- -----------------------------------------------------------------------------
-- Keep the existing public IDs, but bind records to Supabase Auth identities.
alter table if exists parents
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

alter table if exists students
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists idx_parents_auth_user_id on parents(auth_user_id);
create index if not exists idx_students_auth_user_id on students(auth_user_id);

-- -----------------------------------------------------------------------------
-- NORMALIZED TOPIC MASTERY
-- -----------------------------------------------------------------------------
create table if not exists topic_masteries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  topic varchar(255) not null,
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  mastery_state varchar(30) not null default 'foundational',
  status varchar(30) not null default 'not_started',
  questions_attempted integer not null default 0 check (questions_attempted >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  incorrect_answers integer not null default 0 check (incorrect_answers >= 0),
  difficulty_level integer not null default 2 check (difficulty_level between 1 and 5),
  consecutive_correct integer not null default 0 check (consecutive_correct >= 0),
  consecutive_incorrect integer not null default 0 check (consecutive_incorrect >= 0),
  last_attempted_at timestamptz,
  last_mastered_at timestamptz,
  next_review_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  review_interval_days integer not null default 1 check (review_interval_days >= 1),
  recent_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  unique(student_id, chapter_id, topic)
);

create index if not exists idx_topic_masteries_student on topic_masteries(student_id);
create index if not exists idx_topic_masteries_chapter on topic_masteries(chapter_id);
create index if not exists idx_topic_masteries_review on topic_masteries(student_id, next_review_at);

-- -----------------------------------------------------------------------------
-- IMMUTABLE ATTEMPT HISTORY
-- -----------------------------------------------------------------------------
create table if not exists learning_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  topic varchar(255) not null,
  question_id uuid,
  question_text text not null,
  student_answer text,
  expected_answer text,
  evaluation_status varchar(30) not null check (evaluation_status in ('correct','partially_correct','incorrect','unclear')),
  score_delta numeric(6,2) not null default 0,
  difficulty_level integer not null check (difficulty_level between 1 and 5),
  mistake_type varchar(30),
  mistake_description text,
  concept_understood text,
  created_at timestamptz not null default timezone('utc', now()),
  client_attempt_id text
);

create unique index if not exists uq_learning_attempts_client_attempt on learning_attempts(client_attempt_id) where client_attempt_id is not null;
create index if not exists idx_learning_attempts_student_time on learning_attempts(student_id, created_at desc);
create index if not exists idx_learning_attempts_topic on learning_attempts(student_id, chapter_id, topic, created_at desc);

-- -----------------------------------------------------------------------------
-- QUESTION ENTITIES / ACTIVE QUESTION STATE
-- -----------------------------------------------------------------------------
create table if not exists tutor_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete set null,
  topic varchar(255),
  question_text text not null,
  answer_type varchar(30) not null default 'open_ended',
  expected_answer text,
  accepted_answers jsonb not null default '[]'::jsonb,
  grading_method varchar(30) not null default 'ai',
  difficulty_level integer not null check (difficulty_level between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  answered_at timestamptz
);

create unique index if not exists uq_active_tutor_question_per_student
  on tutor_questions(student_id)
  where answered_at is null;

create index if not exists idx_tutor_questions_student_time on tutor_questions(student_id, created_at desc);

-- -----------------------------------------------------------------------------
-- MISTAKE MEMORY (normalized instead of embedded JSON only)
-- -----------------------------------------------------------------------------
create table if not exists mistake_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  topic varchar(255) not null,
  question_id uuid references tutor_questions(id) on delete set null,
  question text,
  student_answer text,
  expected_answer text,
  mistake_type varchar(30) not null,
  description text not null,
  explanation text,
  frequency integer not null default 1 check (frequency >= 1),
  correct_since_mistake integer not null default 0 check (correct_since_mistake >= 0),
  resolved boolean not null default false,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_mistakes_student_open on mistake_records(student_id, resolved, last_seen_at desc);
create index if not exists idx_mistakes_topic on mistake_records(student_id, chapter_id, topic, resolved);

-- -----------------------------------------------------------------------------
-- SESSION + DAILY ACTIVITY
-- -----------------------------------------------------------------------------
create table if not exists learning_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete set null,
  topic varchar(255),
  mode varchar(30) not null,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  questions_attempted integer not null default 0,
  correct_answers integer not null default 0,
  incorrect_answers integer not null default 0,
  starting_mastery integer,
  ending_mastery integer,
  starting_difficulty integer,
  ending_difficulty integer,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_learning_sessions_student on learning_sessions(student_id, started_at desc);

create table if not exists daily_learning_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  learning_date date not null,
  study_time_seconds integer not null default 0 check (study_time_seconds >= 0),
  subjects_studied jsonb not null default '[]'::jsonb,
  topics_studied jsonb not null default '[]'::jsonb,
  questions_attempted integer not null default 0,
  correct_answers integer not null default 0,
  incorrect_answers integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  unique(student_id, learning_date)
);

-- -----------------------------------------------------------------------------
-- RAG CHUNKS WITH VECTOR STORAGE
-- -----------------------------------------------------------------------------
alter table if exists knowledge_documents
  add column if not exists active boolean not null default true;

alter table if exists knowledge_documents
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  page_number integer,
  topic varchar(255),
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(3072),
  created_at timestamptz not null default timezone('utc', now()),
  unique(document_id, chunk_index)
);

create index if not exists idx_knowledge_chunks_document on knowledge_chunks(document_id, chunk_index);

-- IVFFlat can be created after enough vectors exist. Keep it out of the first
-- migration so a fresh/empty project does not fail during deployment.
-- Example later:
-- create index ... using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- -----------------------------------------------------------------------------
-- UPDATED_AT HELPER
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_parents_updated_at on parents;
create trigger trg_parents_updated_at before update on parents
for each row execute function public.set_updated_at();

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at before update on students
for each row execute function public.set_updated_at();

drop trigger if exists trg_topic_masteries_updated_at on topic_masteries;
create trigger trg_topic_masteries_updated_at before update on topic_masteries
for each row execute function public.set_updated_at();

drop trigger if exists trg_mistakes_updated_at on mistake_records;
create trigger trg_mistakes_updated_at before update on mistake_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_sessions_updated_at on learning_sessions;
create trigger trg_sessions_updated_at before update on learning_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_learning_updated_at on daily_learning_records;
create trigger trg_daily_learning_updated_at before update on daily_learning_records
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- Parent-owned records are visible only to the authenticated parent who owns
-- the student. Student auth identities may access their own row as well.

alter table parents enable row level security;
alter table students enable row level security;
alter table student_subjects enable row level security;
alter table learning_progress enable row level security;
alter table learning_memory enable row level security;
alter table topic_masteries enable row level security;
alter table learning_attempts enable row level security;
alter table tutor_questions enable row level security;
alter table mistake_records enable row level security;
alter table learning_sessions enable row level security;
alter table daily_learning_records enable row level security;
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

-- Helper: whether the current auth user owns a student.
create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
    join parents p on p.id = s.parent_id
    where s.id = target_student_id
      and (p.auth_user_id = auth.uid() or s.auth_user_id = auth.uid())
  );
$$;

-- Parents: only the signed-in owner row.
drop policy if exists parents_self_select on parents;
create policy parents_self_select on parents for select
using (auth_user_id = auth.uid());

drop policy if exists parents_self_update on parents;
create policy parents_self_update on parents for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- Students.
drop policy if exists students_owner_select on students;
create policy students_owner_select on students for select
using (can_access_student(id));

drop policy if exists students_owner_update on students;
create policy students_owner_update on students for update
using (can_access_student(id))
with check (can_access_student(id));

-- Parent/student-owned data helper policies.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'student_subjects','learning_progress','learning_memory','topic_masteries',
    'learning_attempts','tutor_questions','mistake_records','learning_sessions',
    'daily_learning_records'
  ] LOOP
    EXECUTE format('drop policy if exists %I_owner_all on %I', t, t);
    EXECUTE format('create policy %I_owner_all on %I for all using (can_access_student(student_id)) with check (can_access_student(student_id))', t, t);
  END LOOP;
END $$;

-- Curriculum can be readable to authenticated users; mutations should be done
-- through trusted server/admin tooling, not directly from the student client.
drop policy if exists subjects_authenticated_select on subjects;
create policy subjects_authenticated_select on subjects for select
using (auth.role() = 'authenticated');

drop policy if exists chapters_authenticated_select on chapters;
create policy chapters_authenticated_select on chapters for select
using (auth.role() = 'authenticated');

drop policy if exists knowledge_documents_authenticated_select on knowledge_documents;
create policy knowledge_documents_authenticated_select on knowledge_documents for select
using (auth.role() = 'authenticated' and active = true);

drop policy if exists knowledge_chunks_authenticated_select on knowledge_chunks;
create policy knowledge_chunks_authenticated_select on knowledge_chunks for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1 from knowledge_documents d
    where d.id = knowledge_chunks.document_id and d.active = true
  )
);

-- -----------------------------------------------------------------------------
-- SAFETY CHECKS
-- -----------------------------------------------------------------------------
-- The application must use the service role only on the trusted server for
-- privileged writes. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.

-- -----------------------------------------------------------------------------
-- PHASE 3: RUNTIME COMPATIBILITY + LEGACY ID MAPPING
-- -----------------------------------------------------------------------------
-- The existing UI/API uses stable string IDs (e.g. sub_maths, chap_math_1).
-- Keep those IDs as external identifiers while Supabase retains UUID PKs.
alter table parents add column if not exists legacy_id text;
alter table students add column if not exists legacy_id text;
alter table subjects add column if not exists legacy_id text;
alter table chapters add column if not exists legacy_id text;
alter table topic_masteries add column if not exists legacy_id text;
alter table tutor_questions add column if not exists legacy_id text;
alter table mistake_records add column if not exists legacy_id text;
alter table learning_sessions add column if not exists legacy_id text;
alter table daily_learning_records add column if not exists legacy_id text;
alter table knowledge_documents add column if not exists legacy_id text;

create unique index if not exists uq_parents_legacy_id on parents(legacy_id) where legacy_id is not null;
create unique index if not exists uq_students_legacy_id on students(legacy_id) where legacy_id is not null;
create unique index if not exists uq_subjects_legacy_id on subjects(legacy_id) where legacy_id is not null;
create unique index if not exists uq_chapters_legacy_id on chapters(legacy_id) where legacy_id is not null;
create unique index if not exists uq_topic_masteries_legacy_id on topic_masteries(legacy_id) where legacy_id is not null;
create unique index if not exists uq_tutor_questions_legacy_id on tutor_questions(legacy_id) where legacy_id is not null;
create unique index if not exists uq_mistake_records_legacy_id on mistake_records(legacy_id) where legacy_id is not null;
create unique index if not exists uq_learning_sessions_legacy_id on learning_sessions(legacy_id) where legacy_id is not null;
create unique index if not exists uq_daily_learning_records_legacy_id on daily_learning_records(legacy_id) where legacy_id is not null;
create unique index if not exists uq_knowledge_documents_legacy_id on knowledge_documents(legacy_id) where legacy_id is not null;

create table if not exists student_learning_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references students(id) on delete cascade,
  total_study_time_seconds integer not null default 0 check (total_study_time_seconds >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  total_correct numeric(10,2) not null default 0 check (total_correct >= 0),
  total_incorrect numeric(10,2) not null default 0 check (total_incorrect >= 0),
  overall_mastery integer not null default 0 check (overall_mastery between 0 and 100),
  current_streak integer not null default 0 check (current_streak >= 0),
  last_study_date date,
  preferred_difficulty integer not null default 2 check (preferred_difficulty between 1 and 5),
  daily_study_goal_minutes integer not null default 20 check (daily_study_goal_minutes between 5 and 120),
  priority_subjects jsonb not null default '[]'::jsonb,
  legacy_id text,
  updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists uq_student_learning_profiles_legacy_id on student_learning_profiles(legacy_id) where legacy_id is not null;

alter table student_learning_profiles enable row level security;
drop policy if exists student_learning_profiles_owner_all on student_learning_profiles;
create policy student_learning_profiles_owner_all on student_learning_profiles for all
using (can_access_student(student_id)) with check (can_access_student(student_id));

drop trigger if exists trg_student_learning_profiles_updated_at on student_learning_profiles;
create trigger trg_student_learning_profiles_updated_at before update on student_learning_profiles
for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- ATOMIC LEARNING WRITE
-- -----------------------------------------------------------------------------
-- The application computes the adaptive result, then sends the complete state
-- to this function. PostgreSQL commits the attempt, mastery, mistake and profile
-- together, preventing partial durable writes on retries or transient failures.
create or replace function public.record_learning_attempt_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p_student_id uuid;
  p_subject_id uuid;
  p_chapter_id uuid;
  p_mastery jsonb := coalesce(payload->'mastery', '{}'::jsonb);
  p_attempt jsonb := coalesce(payload->'attempt', '{}'::jsonb);
  p_profile jsonb := coalesce(payload->'profile', '{}'::jsonb);
  p_mistake jsonb := payload->'mistake';
  p_attempt_id text := nullif(payload->>'client_attempt_id','');
  existing_attempt uuid;
begin
  select id into p_student_id from students where legacy_id = payload->>'student_id' limit 1;
  select id into p_subject_id from subjects where legacy_id = p_attempt->>'subject_id' limit 1;
  select id into p_chapter_id from chapters where legacy_id = p_attempt->>'chapter_id' limit 1;

  if p_student_id is null or p_subject_id is null or p_chapter_id is null then
    raise exception 'REFERENCE_MAPPING_FAILED';
  end if;

  if p_attempt_id is not null then
    select id into existing_attempt from learning_attempts where client_attempt_id = p_attempt_id limit 1;
    if existing_attempt is not null then
      return jsonb_build_object('status','duplicate','attempt_id',existing_attempt);
    end if;
  end if;

  insert into topic_masteries (
    student_id, subject_id, chapter_id, topic, mastery_score, mastery_state, status,
    questions_attempted, correct_answers, incorrect_answers, difficulty_level,
    consecutive_correct, consecutive_incorrect, last_attempted_at, last_mastered_at,
    next_review_at, review_count, review_interval_days, recent_history, legacy_id, updated_at
  ) values (
    p_student_id, p_subject_id, p_chapter_id, p_mastery->>'topic',
    coalesce((p_mastery->>'mastery_score')::integer,0), coalesce(p_mastery->>'mastery_state','foundational'),
    coalesce(p_mastery->>'status','learning'), coalesce((p_mastery->>'questions_attempted')::integer,0),
    coalesce((p_mastery->>'correct_answers')::numeric,0), coalesce((p_mastery->>'incorrect_answers')::numeric,0),
    coalesce((p_mastery->>'difficulty_level')::integer,2), coalesce((p_mastery->>'consecutive_correct')::integer,0),
    coalesce((p_mastery->>'consecutive_incorrect')::integer,0), nullif(p_mastery->>'last_attempted_at','')::timestamptz,
    nullif(p_mastery->>'last_mastered_at','')::timestamptz, nullif(p_mastery->>'next_review_at','')::timestamptz,
    coalesce((p_mastery->>'review_count')::integer,0), coalesce((p_mastery->>'review_interval_days')::integer,1),
    coalesce(p_mastery->'recent_history','[]'::jsonb), p_mastery->>'id', timezone('utc',now())
  ) on conflict (student_id, chapter_id, topic) do update set
    mastery_score=excluded.mastery_score, mastery_state=excluded.mastery_state, status=excluded.status,
    questions_attempted=excluded.questions_attempted, correct_answers=excluded.correct_answers,
    incorrect_answers=excluded.incorrect_answers, difficulty_level=excluded.difficulty_level,
    consecutive_correct=excluded.consecutive_correct, consecutive_incorrect=excluded.consecutive_incorrect,
    last_attempted_at=excluded.last_attempted_at, last_mastered_at=excluded.last_mastered_at,
    next_review_at=excluded.next_review_at, review_count=excluded.review_count,
    review_interval_days=excluded.review_interval_days, recent_history=excluded.recent_history,
    updated_at=timezone('utc',now());

  insert into learning_attempts (
    student_id, subject_id, chapter_id, topic, question_text, student_answer, expected_answer,
    evaluation_status, score_delta, difficulty_level, mistake_type, mistake_description,
    concept_understood, client_attempt_id
  ) values (
    p_student_id, p_subject_id, p_chapter_id, p_attempt->>'topic', coalesce(p_attempt->>'question',''),
    p_attempt->>'student_answer', p_attempt->>'expected_answer', p_attempt->>'status',
    case when p_attempt->>'status'='correct' then 10 when p_attempt->>'status'='partially_correct' then 5 else 0 end,
    coalesce((p_mastery->>'difficulty_level')::integer,2), p_attempt->>'mistake_type',
    p_attempt->>'mistake_description', p_attempt->>'concept_understood', p_attempt_id
  ) returning id into existing_attempt;

  if p_mistake is not null then
    insert into mistake_records (
      student_id, subject_id, chapter_id, topic, question, student_answer, expected_answer,
      mistake_type, description, explanation, frequency, correct_since_mistake, resolved,
      first_seen_at, last_seen_at, legacy_id
    ) values (
      p_student_id, p_subject_id, p_chapter_id, p_mistake->>'topic', p_mistake->>'question',
      p_mistake->>'student_answer', p_mistake->>'expected_answer', p_mistake->>'mistake_type',
      coalesce(p_mistake->>'description',''), p_mistake->>'explanation', coalesce((p_mistake->>'frequency')::integer,1),
      coalesce((p_mistake->>'correct_since_mistake')::integer,0), coalesce((p_mistake->>'resolved')::boolean,false),
      coalesce(nullif(p_mistake->>'first_seen_at','')::timestamptz,timezone('utc',now())), timezone('utc',now()),
      p_mistake->>'id'
    ) on conflict (legacy_id) do update set
      frequency=excluded.frequency, correct_since_mistake=excluded.correct_since_mistake,
      resolved=excluded.resolved, description=excluded.description, explanation=excluded.explanation,
      last_seen_at=excluded.last_seen_at, updated_at=timezone('utc',now());
  end if;

  insert into student_learning_profiles (
    student_id,total_study_time_seconds,total_questions,total_correct,total_incorrect,overall_mastery,
    current_streak,last_study_date,preferred_difficulty,daily_study_goal_minutes,priority_subjects,updated_at
  ) values (
    p_student_id,coalesce((p_profile->>'total_study_time_seconds')::integer,0),coalesce((p_profile->>'total_questions')::integer,0),
    coalesce((p_profile->>'total_correct')::numeric,0),coalesce((p_profile->>'total_incorrect')::numeric,0),coalesce((p_profile->>'overall_mastery')::integer,0),
    coalesce((p_profile->>'current_streak')::integer,0),nullif(p_profile->>'last_study_date','')::date,
    coalesce((p_profile->>'preferred_difficulty')::integer,2),coalesce((p_profile->>'daily_study_goal_minutes')::integer,20),
    coalesce(p_profile->'priority_subjects','[]'::jsonb),timezone('utc',now())
  ) on conflict (student_id) do update set
    total_study_time_seconds=excluded.total_study_time_seconds,total_questions=excluded.total_questions,
    total_correct=excluded.total_correct,total_incorrect=excluded.total_incorrect,overall_mastery=excluded.overall_mastery,
    current_streak=excluded.current_streak,last_study_date=excluded.last_study_date,preferred_difficulty=excluded.preferred_difficulty,
    daily_study_goal_minutes=excluded.daily_study_goal_minutes,priority_subjects=excluded.priority_subjects,updated_at=timezone('utc',now());

  return jsonb_build_object('status','committed','attempt_id',existing_attempt);
end;
$$;

revoke execute on function public.record_learning_attempt_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.record_learning_attempt_atomic(jsonb) to service_role;
