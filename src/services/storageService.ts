import {
  Parent,
  Student,
  Subject,
  Chapter,
  LearningProgress,
} from '../types';
import {
  INITIAL_PARENT,
  INITIAL_STUDENT,
  INITIAL_SUBJECTS,
  INITIAL_CHAPTERS,
  INITIAL_PROGRESS,
} from '../db/initialData';

const STORAGE_KEYS = {
  PARENT: 'athmik_parent_data',
  STUDENT: 'athmik_student_data',
  SUBJECTS: 'athmik_subjects_data',
  CHAPTERS: 'athmik_chapters_data',
  PROGRESS: 'athmik_learning_progress_data',
  ACTIVE_ROLE: 'athmik_active_role',
  INITIALIZED: 'athmik_db_initialized_v1',
};

class StorageService {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    try {
      const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!isInitialized) {
        this.resetToDefaults();
      }
    } catch (err) {
      console.error('StorageService: LocalStorage initialization error', err);
    }
  }

  public resetToDefaults(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PARENT, JSON.stringify(INITIAL_PARENT));
      localStorage.setItem(STORAGE_KEYS.STUDENT, JSON.stringify(INITIAL_STUDENT));
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
      localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(INITIAL_CHAPTERS));
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(INITIAL_PROGRESS));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    } catch (err) {
      console.error('StorageService: Error resetting to defaults', err);
    }
  }

  // Active Role State Persistence
  public getActiveRole(): 'parent' | 'student' {
    try {
      const role = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE);
      return role === 'parent' ? 'parent' : 'student';
    } catch {
      return 'student';
    }
  }

  public setActiveRole(role: 'parent' | 'student'): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, role);
    } catch (err) {
      console.error('Failed to set active role in storage', err);
    }
  }

  // Parent CRUD
  public getParent(): Parent {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PARENT);
      return data ? JSON.parse(data) : INITIAL_PARENT;
    } catch {
      return INITIAL_PARENT;
    }
  }

  public updateParent(parent: Partial<Parent>): Parent {
    const current = this.getParent();
    const updated: Parent = {
      ...current,
      ...parent,
      updated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEYS.PARENT, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update parent', err);
    }
    return updated;
  }

  // Student CRUD
  public getStudent(): Student {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENT);
      return data ? JSON.parse(data) : INITIAL_STUDENT;
    } catch {
      return INITIAL_STUDENT;
    }
  }

  public updateStudent(student: Partial<Student>): Student {
    const current = this.getStudent();
    const updated: Student = {
      ...current,
      ...student,
      updated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENT, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update student profile', err);
    }
    return updated;
  }

  // Subjects CRUD
  public getSubjects(): Subject[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (!data) return INITIAL_SUBJECTS;
      const parsed: Subject[] = JSON.parse(data);
      return parsed.sort((a, b) => a.display_order - b.display_order);
    } catch {
      return INITIAL_SUBJECTS;
    }
  }

  public getActiveSubjects(): Subject[] {
    return this.getSubjects().filter((s) => s.active);
  }

  public getSubjectById(subjectId: string): Subject | undefined {
    return this.getSubjects().find((s) => s.id === subjectId);
  }

  public saveSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Subject {
    const subjects = this.getSubjects();
    const now = new Date().toISOString();

    if (subject.id && subjects.some((s) => s.id === subject.id)) {
      const updatedSubjects = subjects.map((s) =>
        s.id === subject.id ? { ...s, ...subject, updated_at: now } : s
      );
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updatedSubjects));
      return updatedSubjects.find((s) => s.id === subject.id)!;
    } else {
      const newSubject: Subject = {
        ...subject,
        id: subject.id || `sub_${Date.now()}`,
        display_order: subject.display_order || subjects.length + 1,
        created_at: now,
        updated_at: now,
      };
      subjects.push(newSubject);
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
      return newSubject;
    }
  }

  public toggleSubjectActive(subjectId: string): Subject | null {
    const subjects = this.getSubjects();
    const target = subjects.find((s) => s.id === subjectId);
    if (!target) return null;

    target.active = !target.active;
    target.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    return target;
  }

  public deleteSubject(subjectId: string): boolean {
    const subjects = this.getSubjects();
    const filtered = subjects.filter((s) => s.id !== subjectId);
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(filtered));

    // Also cascade remove chapters and progress for this subject
    const chapters = this.getChapters().filter((c) => c.subject_id !== subjectId);
    localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(chapters));

    const progress = this.getProgress().filter((p) => p.subject_id !== subjectId);
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));

    return true;
  }

  // Chapters CRUD
  public getChapters(subjectId?: string): Chapter[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHAPTERS);
      const list: Chapter[] = data ? JSON.parse(data) : INITIAL_CHAPTERS;
      const sorted = list.sort((a, b) => a.chapter_number - b.chapter_number || a.display_order - b.display_order);
      if (subjectId) {
        return sorted.filter((c) => c.subject_id === subjectId);
      }
      return sorted;
    } catch {
      return INITIAL_CHAPTERS;
    }
  }

  public getActiveChapters(subjectId?: string): Chapter[] {
    const list = this.getChapters(subjectId);
    return list.filter((c) => c.active);
  }

  public getChapterById(chapterId: string): Chapter | undefined {
    return this.getChapters().find((c) => c.id === chapterId);
  }

  public saveChapter(chapter: Omit<Chapter, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Chapter {
    const chapters = this.getChapters();
    const now = new Date().toISOString();

    if (chapter.id && chapters.some((c) => c.id === chapter.id)) {
      const updatedList = chapters.map((c) =>
        c.id === chapter.id ? { ...c, ...chapter, updated_at: now } : c
      );
      localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(updatedList));
      return updatedList.find((c) => c.id === chapter.id)!;
    } else {
      const newChapter: Chapter = {
        ...chapter,
        id: chapter.id || `chap_${Date.now()}`,
        display_order: chapter.display_order || chapters.length + 1,
        created_at: now,
        updated_at: now,
      };
      chapters.push(newChapter);
      localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(chapters));
      return newChapter;
    }
  }

  public toggleChapterActive(chapterId: string): Chapter | null {
    const chapters = this.getChapters();
    const target = chapters.find((c) => c.id === chapterId);
    if (!target) return null;

    target.active = !target.active;
    target.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(chapters));
    return target;
  }

  public deleteChapter(chapterId: string): boolean {
    const chapters = this.getChapters();
    const filtered = chapters.filter((c) => c.id !== chapterId);
    localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(filtered));

    // Cascade remove progress for this chapter
    const progress = this.getProgress().filter((p) => p.chapter_id !== chapterId);
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));

    return true;
  }

  // Learning Progress CRUD
  public getProgress(): LearningProgress[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public getChapterProgress(studentId: string, chapterId: string): LearningProgress | undefined {
    return this.getProgress().find((p) => p.student_id === studentId && p.chapter_id === chapterId);
  }

  public updateChapterProgress(
    studentId: string,
    subjectId: string,
    chapterId: string,
    status: 'not_started' | 'in_progress' | 'completed',
    masteryScore: number = 0,
    topic?: string
  ): LearningProgress {
    const progressList = this.getProgress();
    const now = new Date().toISOString();
    const existingIndex = progressList.findIndex(
      (p) => p.student_id === studentId && p.chapter_id === chapterId
    );

    if (existingIndex >= 0) {
      progressList[existingIndex] = {
        ...progressList[existingIndex],
        status,
        mastery_score: Math.min(100, Math.max(0, masteryScore)),
        last_studied_at: now,
        updated_at: now,
        topic: topic ?? progressList[existingIndex].topic,
      };
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progressList));
      return progressList[existingIndex];
    } else {
      const newProgress: LearningProgress = {
        id: `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        student_id: studentId,
        subject_id: subjectId,
        chapter_id: chapterId,
        topic: topic ?? '',
        status,
        mastery_score: Math.min(100, Math.max(0, masteryScore)),
        last_studied_at: now,
        created_at: now,
        updated_at: now,
      };
      progressList.push(newProgress);
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progressList));
      return newProgress;
    }
  }
}

export const storageService = new StorageService();
