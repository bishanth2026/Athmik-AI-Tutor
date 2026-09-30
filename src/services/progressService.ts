import { storageService } from './storageService';
import { SubjectProgressStat, OverallProgressStat, LearningProgress, ProgressStatus } from '../types';

export const progressService = {
  getStudentProgress(studentId: string): LearningProgress[] {
    return storageService.getProgress().filter((p) => p.student_id === studentId);
  },

  getChapterStatus(studentId: string, chapterId: string): { status: ProgressStatus; masteryScore: number; lastStudiedAt?: string } {
    const record = storageService.getChapterProgress(studentId, chapterId);
    if (!record) {
      return { status: 'not_started', masteryScore: 0 };
    }
    return {
      status: record.status,
      masteryScore: record.mastery_score,
      lastStudiedAt: record.last_studied_at,
    };
  },

  updateChapterStatus(
    studentId: string,
    subjectId: string,
    chapterId: string,
    status: ProgressStatus,
    masteryScore: number = 0,
    topic?: string
  ): LearningProgress {
    return storageService.updateChapterProgress(studentId, subjectId, chapterId, status, masteryScore, topic);
  },

  // Calculate strict progress per subject
  getSubjectProgress(studentId: string, subjectId: string): SubjectProgressStat {
    const subject = storageService.getSubjectById(subjectId);
    const activeChapters = storageService.getActiveChapters(subjectId);
    const progressRecords = this.getStudentProgress(studentId).filter((p) => p.subject_id === subjectId);

    const totalChapters = activeChapters.length;
    let completedChapters = 0;
    let inProgressChapters = 0;

    activeChapters.forEach((chapter) => {
      const record = progressRecords.find((p) => p.chapter_id === chapter.id);
      if (record?.status === 'completed') {
        completedChapters++;
      } else if (record?.status === 'in_progress') {
        inProgressChapters++;
      }
    });

    const notStartedChapters = Math.max(0, totalChapters - completedChapters - inProgressChapters);
    const progressPercentage = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

    return {
      subject_id: subjectId,
      subject_name: subject?.name || 'Unknown Subject',
      icon: subject?.icon || 'BookOpen',
      total_chapters: totalChapters,
      completed_chapters: completedChapters,
      in_progress_chapters: inProgressChapters,
      not_started_chapters: notStartedChapters,
      progress_percentage: progressPercentage,
    };
  },

  // Calculate strict overall progress across all active subjects & chapters
  getOverallProgress(studentId: string): OverallProgressStat {
    const activeSubjects = storageService.getActiveSubjects();
    const progressRecords = this.getStudentProgress(studentId);

    let totalActiveChapters = 0;
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalMasterySum = 0;
    let scoredChaptersCount = 0;

    activeSubjects.forEach((subject) => {
      const chapters = storageService.getActiveChapters(subject.id);
      totalActiveChapters += chapters.length;

      chapters.forEach((chapter) => {
        const record = progressRecords.find((p) => p.chapter_id === chapter.id);
        if (record?.status === 'completed') {
          totalCompleted++;
        } else if (record?.status === 'in_progress') {
          totalInProgress++;
        }

        if (record && record.mastery_score > 0) {
          totalMasterySum += record.mastery_score;
          scoredChaptersCount++;
        }
      });
    });

    const notStartedChapters = Math.max(0, totalActiveChapters - totalCompleted - totalInProgress);
    const overallPercentage = totalActiveChapters > 0 ? Math.round((totalCompleted / totalActiveChapters) * 100) : 0;
    const averageMastery = scoredChaptersCount > 0 ? Math.round(totalMasterySum / scoredChaptersCount) : 0;

    return {
      total_active_subjects: activeSubjects.length,
      total_active_chapters: totalActiveChapters,
      completed_chapters: totalCompleted,
      in_progress_chapters: totalInProgress,
      not_started_chapters: notStartedChapters,
      overall_progress_percentage: overallPercentage,
      average_mastery_score: averageMastery,
    };
  },

  // Get recently studied items
  getRecentActivity(studentId: string, limit = 5): { chapterName: string; subjectName: string; status: ProgressStatus; updatedAt: string }[] {
    const progressList = this.getStudentProgress(studentId)
      .filter((p) => p.status !== 'not_started')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);

    return progressList.map((p) => {
      const subject = storageService.getSubjectById(p.subject_id);
      const chapter = storageService.getChapterById(p.chapter_id);
      return {
        chapterName: chapter ? `Ch ${chapter.chapter_number}: ${chapter.chapter_name}` : 'Unknown Chapter',
        subjectName: subject?.name || 'Subject',
        status: p.status,
        updatedAt: p.last_studied_at || p.updated_at,
      };
    });
  },
};
