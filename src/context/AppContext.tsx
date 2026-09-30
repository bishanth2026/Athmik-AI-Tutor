import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserRole,
  Student,
  Parent,
  Subject,
  Chapter,
  LearningProgress,
  OverallProgressStat,
  SubjectProgressStat,
} from '../types';
import { storageService } from '../services/storageService';
import { progressService } from '../services/progressService';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  student: Student;
  parent: Parent;
  subjects: Subject[];
  activeSubjects: Subject[];
  chapters: Chapter[];
  progress: LearningProgress[];
  overallProgress: OverallProgressStat;
  getSubjectProgress: (subjectId: string) => SubjectProgressStat;
  refreshData: () => void;
  resetAllData: () => void;
  isLoading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => storageService.getActiveRole());
  const [student, setStudent] = useState<Student>(() => storageService.getStudent());
  const [parent, setParent] = useState<Parent>(() => storageService.getParent());
  const [subjects, setSubjects] = useState<Subject[]>(() => storageService.getSubjects());
  const [chapters, setChapters] = useState<Chapter[]>(() => storageService.getChapters());
  const [progress, setProgress] = useState<LearningProgress[]>(() => storageService.getProgress());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const setRole = (newRole: UserRole) => {
    storageService.setActiveRole(newRole);
    setRoleState(newRole);
  };

  const refreshData = useCallback(() => {
    try {
      setStudent(storageService.getStudent());
      setParent(storageService.getParent());
      setSubjects(storageService.getSubjects());
      setChapters(storageService.getChapters());
      setProgress(storageService.getProgress());
    } catch (err) {
      console.error('Failed to load application data:', err);
      setError('We could not load updated records from storage. Please try refreshing.');
    }
  }, []);

  const resetAllData = useCallback(() => {
    try {
      storageService.resetToDefaults();
      refreshData();
    } catch (err) {
      console.error('Reset error:', err);
      setError('Failed to reset storage to default curriculum.');
    }
  }, [refreshData]);

  useEffect(() => {
    // Initial sync
    refreshData();
  }, [refreshData]);

  const activeSubjects = useMemo(() => {
    return subjects.filter((s) => s.active);
  }, [subjects]);

  const overallProgress = useMemo(() => {
    return progressService.getOverallProgress(student.id);
  }, [student.id, subjects, chapters, progress]);

  const getSubjectProgress = useCallback(
    (subjectId: string): SubjectProgressStat => {
      return progressService.getSubjectProgress(student.id, subjectId);
    },
    [student.id, subjects, chapters, progress]
  );

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        student,
        parent,
        subjects,
        activeSubjects,
        chapters,
        progress,
        overallProgress,
        getSubjectProgress,
        refreshData,
        resetAllData,
        isLoading,
        error,
        setError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
