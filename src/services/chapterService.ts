import { storageService } from './storageService';
import { Chapter } from '../types';

export const chapterService = {
  getChapters(subjectId?: string): Chapter[] {
    return storageService.getChapters(subjectId);
  },

  getActiveChapters(subjectId?: string): Chapter[] {
    return storageService.getActiveChapters(subjectId);
  },

  getChapterById(chapterId: string): Chapter | undefined {
    return storageService.getChapterById(chapterId);
  },

  toggleActive(chapterId: string): Chapter | null {
    return storageService.toggleChapterActive(chapterId);
  },

  saveChapter(chapter: Omit<Chapter, 'id' | 'created_at' | 'updated_at'> & { id?: string }): { success: boolean; error?: string; data?: Chapter } {
    if (!chapter.chapter_name || chapter.chapter_name.trim().length === 0) {
      return { success: false, error: 'Chapter name is required.' };
    }
    if (!chapter.subject_id) {
      return { success: false, error: 'Subject ID is required.' };
    }
    if (typeof chapter.chapter_number !== 'number' || chapter.chapter_number < 1) {
      return { success: false, error: 'Valid chapter number is required.' };
    }

    const saved = storageService.saveChapter(chapter);
    return { success: true, data: saved };
  },

  deleteChapter(chapterId: string): boolean {
    return storageService.deleteChapter(chapterId);
  },
};
