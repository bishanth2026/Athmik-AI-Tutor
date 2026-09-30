import React from 'react';
import { useApp } from '../../context/AppContext';
import { SubjectCard } from '../../components/student/SubjectCard';
import { EmptyState } from '../../components/common/EmptyState';
import { BookOpen } from 'lucide-react';

interface StudentSubjectsViewProps {
  onNavigate: (path: string) => void;
}

export const StudentSubjectsView: React.FC<StudentSubjectsViewProps> = ({ onNavigate }) => {
  const { activeSubjects } = useApp();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1">
          Curriculum Subjects
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">My Subjects</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Select any subject to view chapters, syllabus lessons, and start learning.
        </p>
      </div>

      {activeSubjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects have been configured yet."
          description="Your parent has not enabled any subjects for your Class 5 curriculum yet. Please check with your parent."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeSubjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onClick={() => onNavigate(`/student/subjects/${subject.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
