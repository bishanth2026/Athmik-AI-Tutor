-- ==============================================================================
-- ATHMIK AI TUTOR - POSTGRESQL / SUPABASE PRODUCTION DATABASE SCHEMA
-- Module 1: Foundation Schema & Role-Based Access Architecture
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PARENTS TABLE
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    class VARCHAR(50) NOT NULL DEFAULT '5',
    board VARCHAR(50) NOT NULL DEFAULT 'CBSE',
    academic_year VARCHAR(50) NOT NULL DEFAULT '2026-27',
    school_name VARCHAR(255),
    date_of_birth DATE,
    profile_photo_url TEXT,
    preferred_language VARCHAR(50) NOT NULL DEFAULT 'English',
    learning_preference VARCHAR(100) NOT NULL DEFAULT 'Visual + Explanation + Practice',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    class VARCHAR(50) NOT NULL DEFAULT '5',
    board VARCHAR(50) NOT NULL DEFAULT 'CBSE',
    icon VARCHAR(100) NOT NULL DEFAULT 'BookOpen',
    active BOOLEAN DEFAULT TRUE NOT NULL,
    display_order INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. STUDENT_SUBJECTS TABLE (Customizable active mapping per student)
CREATE TABLE IF NOT EXISTS student_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_student_subject UNIQUE(student_id, subject_id)
);

-- 5. CHAPTERS TABLE
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    chapter_number INT NOT NULL,
    chapter_name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    display_order INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. LEARNING_PROGRESS TABLE
CREATE TABLE IF NOT EXISTS learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    topic VARCHAR(255),
    status VARCHAR(50) NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
    mastery_score INT DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
    last_studied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_student_chapter UNIQUE(student_id, chapter_id)
);

-- FUTURE MODULE 2/3 EXTENSIBILITY TABLES (RAG & MEMORY)
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('textbook', 'school_note', 'worksheet', 'question_paper', 'revision_material')),
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    topic VARCHAR(255),
    class VARCHAR(50) NOT NULL DEFAULT '5',
    board VARCHAR(50) NOT NULL DEFAULT 'CBSE',
    academic_year VARCHAR(50) NOT NULL DEFAULT '2026-27',
    file_url TEXT,
    content_text TEXT,
    embedding_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    mastery_level INT DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
    mistakes_recorded JSONB DEFAULT '[]'::jsonb,
    last_duration_mins INT DEFAULT 0,
    preferred_explanation_style VARCHAR(100),
    revision_needed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_chapters_subject_id ON chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_chapters_display_order ON chapters(display_order);
CREATE INDEX IF NOT EXISTS idx_learning_progress_student ON learning_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_chapter ON learning_progress(chapter_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_subject ON knowledge_documents(subject_id);

-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_memory ENABLE ROW LEVEL SECURITY;

-- Note: In Supabase, RLS policies will bind to auth.uid() matching parents.id or student records.

-- PHASE 4: Supabase Auth ownership mapping.
-- Link application rows to auth.users. The backend also verifies ownership
-- because service-role database calls bypass RLS.
ALTER TABLE parents ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_parents_auth_user_id ON parents(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON students(auth_user_id);

-- Explicit owner policies for direct Supabase client access.
DROP POLICY IF EXISTS parents_owner_select ON parents;
CREATE POLICY parents_owner_select ON parents FOR SELECT USING (auth.uid() = auth_user_id);
DROP POLICY IF EXISTS students_owner_select ON students;
CREATE POLICY students_owner_select ON students FOR SELECT USING (auth.uid() = auth_user_id OR auth.uid() = (SELECT p.auth_user_id FROM parents p WHERE p.id = students.parent_id));
DROP POLICY IF EXISTS student_subjects_owner_select ON student_subjects;
CREATE POLICY student_subjects_owner_select ON student_subjects FOR SELECT USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_subjects.student_id AND (s.auth_user_id = auth.uid() OR s.parent_id IN (SELECT p.id FROM parents p WHERE p.auth_user_id = auth.uid()))));
DROP POLICY IF EXISTS learning_progress_owner_select ON learning_progress;
CREATE POLICY learning_progress_owner_select ON learning_progress FOR SELECT USING (EXISTS (SELECT 1 FROM students s WHERE s.id = learning_progress.student_id AND (s.auth_user_id = auth.uid() OR s.parent_id IN (SELECT p.id FROM parents p WHERE p.auth_user_id = auth.uid()))));
DROP POLICY IF EXISTS learning_memory_owner_select ON learning_memory;
CREATE POLICY learning_memory_owner_select ON learning_memory FOR SELECT USING (EXISTS (SELECT 1 FROM students s WHERE s.id = learning_memory.student_id AND (s.auth_user_id = auth.uid() OR s.parent_id IN (SELECT p.id FROM parents p WHERE p.auth_user_id = auth.uid()))));
