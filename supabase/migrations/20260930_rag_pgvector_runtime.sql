-- Athmik AI Tutor - Phase 7 RAG runtime
-- Durable pgvector knowledge store. No UI changes.
create extension if not exists vector;
create extension if not exists pgcrypto;

alter table if exists subjects add column if not exists legacy_id text;
alter table if exists chapters add column if not exists legacy_id text;
create unique index if not exists uq_subjects_legacy_id on subjects(legacy_id) where legacy_id is not null;
create unique index if not exists uq_chapters_legacy_id on chapters(legacy_id) where legacy_id is not null;

create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title varchar(255) not null,
  doc_type varchar(50) not null,
  subject_id uuid references subjects(id) on delete set null,
  chapter_id uuid references chapters(id) on delete set null,
  topic varchar(255),
  class varchar(50) not null default '5',
  board varchar(50) not null default 'CBSE',
  academic_year varchar(50) not null default '2026-27',
  file_url text,
  content_text text,
  embedding_status varchar(50) default 'pending',
  processing_status varchar(50) default 'pending',
  failure_reason text,
  chunk_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- The Phase 5 migration may already have created these tables. Keep this migration
-- idempotent by adding every RAG-runtime column explicitly when it is missing.
alter table knowledge_documents add column if not exists legacy_id text;
alter table knowledge_documents add column if not exists title varchar(255);
alter table knowledge_documents add column if not exists doc_type varchar(50);
alter table knowledge_documents add column if not exists subject_id uuid;
alter table knowledge_documents add column if not exists chapter_id uuid;
alter table knowledge_documents add column if not exists topic varchar(255);
alter table knowledge_documents add column if not exists class varchar(50) default '5';
alter table knowledge_documents add column if not exists board varchar(50) default 'CBSE';
alter table knowledge_documents add column if not exists academic_year varchar(50) default '2026-27';
alter table knowledge_documents add column if not exists file_url text;
alter table knowledge_documents add column if not exists content_text text;
alter table knowledge_documents add column if not exists embedding_status varchar(50) default 'pending';
alter table knowledge_documents add column if not exists processing_status varchar(50) default 'pending';
alter table knowledge_documents add column if not exists failure_reason text;
alter table knowledge_documents add column if not exists chunk_count integer default 0;
alter table knowledge_documents add column if not exists active boolean not null default true;
alter table knowledge_documents add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table knowledge_documents add column if not exists updated_at timestamptz not null default timezone('utc', now());


create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  page_number integer,
  topic varchar(255),
  metadata jsonb not null default '{}'::jsonb,
  subject_id uuid references subjects(id) on delete set null,
  chapter_id uuid references chapters(id) on delete set null,
  document_title varchar(255),
  document_type varchar(50),
  chapter_name varchar(255),
  class varchar(50) not null default '5',
  board varchar(50) not null default 'CBSE',
  embedding vector(3072),
  created_at timestamptz not null default timezone('utc', now()),
  unique(document_id, chunk_index)
);

alter table knowledge_chunks add column if not exists legacy_id text;
alter table knowledge_chunks add column if not exists document_title varchar(255);
alter table knowledge_chunks add column if not exists document_type varchar(50);
alter table knowledge_chunks add column if not exists subject_id uuid;
alter table knowledge_chunks add column if not exists chapter_id uuid;
alter table knowledge_chunks add column if not exists chapter_name varchar(255);
alter table knowledge_chunks add column if not exists class varchar(50) default '5';
alter table knowledge_chunks add column if not exists board varchar(50) default 'CBSE';
alter table knowledge_chunks add column if not exists embedding vector(3072);


create unique index if not exists uq_knowledge_chunks_legacy_id on knowledge_chunks(legacy_id) where legacy_id is not null;
create index if not exists idx_knowledge_chunks_subject_chapter on knowledge_chunks(subject_id, chapter_id);
create index if not exists idx_knowledge_chunks_document on knowledge_chunks(document_id, chunk_index);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(3072),
  match_count integer default 20,
  filter_subject_id uuid default null,
  filter_chapter_id uuid default null,
  filter_topic text default null
)
returns table (
  id uuid,
  legacy_id text,
  document_id uuid,
  document_legacy_id text,
  document_title text,
  document_type text,
  content text,
  chunk_index integer,
  page_number integer,
  topic text,
  subject_id uuid,
  chapter_id uuid,
  chapter_name text,
  class text,
  board text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id, c.legacy_id, c.document_id, d.legacy_id,
    c.document_title, c.document_type, c.content, c.chunk_index,
    c.page_number, c.topic, c.subject_id, c.chapter_id, c.chapter_name,
    c.class, c.board,
    1 - (c.embedding <=> query_embedding) as similarity
  from knowledge_chunks c
  join knowledge_documents d on d.id = c.document_id
  where d.active = true
    and c.embedding is not null
    and (filter_subject_id is null or c.subject_id = filter_subject_id)
    and (filter_chapter_id is null or c.chapter_id = filter_chapter_id)
    and (filter_topic is null or c.topic is null or lower(c.topic) = lower(filter_topic))
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- Do not create an ANN index until the table has enough vectors. For larger
-- deployments, create HNSW/IVFFlat after backfill and measure recall/latency.

alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

drop policy if exists knowledge_documents_authenticated_select on knowledge_documents;
create policy knowledge_documents_authenticated_select on knowledge_documents
for select to authenticated using (active = true);

drop policy if exists knowledge_chunks_authenticated_select on knowledge_chunks;
create policy knowledge_chunks_authenticated_select on knowledge_chunks
for select to authenticated using (
  exists (select 1 from knowledge_documents d where d.id = knowledge_chunks.document_id and d.active = true)
);

revoke all on function public.match_knowledge_chunks(vector, integer, uuid, uuid, text) from public;
grant execute on function public.match_knowledge_chunks(vector, integer, uuid, uuid, text) to service_role;
