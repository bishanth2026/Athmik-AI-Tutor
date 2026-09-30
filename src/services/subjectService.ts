import { storageService } from './storageService';
import { Subject } from '../types';

export const subjectService = {
  getAllSubjects(): Subject[] {
    return storageService.getSubjects();
  },

  getActiveSubjects(): Subject[] {
    return storageService.getActiveSubjects();
  },

  getSubjectById(subjectId: string): Subject | undefined {
    return storageService.getSubjectById(subjectId);
  },

  toggleActive(subjectId: string): Subject | null {
    return storageService.toggleSubjectActive(subjectId);
  },

  saveSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'> & { id?: string }): { success: boolean; error?: string; data?: Subject } {
    if (!subject.name || subject.name.trim().length === 0) {
      return { success: false, error: 'Subject name is required.' };
    }
    const saved = storageService.saveSubject(subject);
    return { success: true, data: saved };
  },

  deleteSubject(subjectId: string): boolean {
    return storageService.deleteSubject(subjectId);
  },
};
