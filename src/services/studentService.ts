import { storageService } from './storageService';
import { Student } from '../types';

export interface StudentValidationErrors {
  name?: string;
  class?: string;
  board?: string;
  academic_year?: string;
  preferred_language?: string;
  learning_preference?: string;
}

export const studentService = {
  getStudent(): Student {
    return storageService.getStudent();
  },

  updateProfile(profile: Partial<Student>): { success: boolean; errors?: StudentValidationErrors; data?: Student } {
    // Form Validation rules as per section 20
    const errors: StudentValidationErrors = {};

    if (!profile.name || profile.name.trim().length === 0) {
      errors.name = 'Student name is required.';
    }
    if (!profile.class || profile.class.trim().length === 0) {
      errors.class = 'Class is required.';
    }
    if (!profile.board || profile.board.trim().length === 0) {
      errors.board = 'Educational board is required (e.g. CBSE).';
    }
    if (!profile.academic_year || profile.academic_year.trim().length === 0) {
      errors.academic_year = 'Academic year is required (e.g. 2026-27).';
    }
    if (!profile.preferred_language || profile.preferred_language.trim().length === 0) {
      errors.preferred_language = 'Preferred language is required.';
    }
    if (!profile.learning_preference || profile.learning_preference.trim().length === 0) {
      errors.learning_preference = 'Learning preference is required.';
    }

    if (Object.keys(errors).length > 0) {
      return { success: false, errors };
    }

    const updated = storageService.updateStudent(profile);
    return { success: true, data: updated };
  },
};
