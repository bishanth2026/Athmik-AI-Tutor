import React from 'react';
import { Subject } from '../../types';
import { useApp } from '../../context/AppContext';
import { SubjectIcon } from '../common/SubjectIcon';
import { ProgressBar } from '../common/ProgressBar';
import { ChevronRight, BookOpen } from 'lucide-react';

interface SubjectCardProps {
  subject: Subject;
  onClick: () => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onClick }) => {
  const { getSubjectProgress } = useApp();
  const stat = getSubjectProgress(subject.id);

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 flex items-center justify-center transition-colors shrink-0 shadow-xs">
            <SubjectIcon name={subject.icon} className="w-6 h-6 transition-colors" />
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-1">
          {subject.name}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
          {subject.description || 'CBSE Class 5 Curriculum syllabus.'}
        </p>
      </div>

      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>{stat.total_chapters} {stat.total_chapters === 1 ? 'Chapter' : 'Chapters'}</span>
          </span>
          <span className="font-mono tabular-nums text-slate-700 font-semibold">
            {stat.completed_chapters}/{stat.total_chapters} Done
          </span>
        </div>

        {/* Calculated Progress Bar */}
        <ProgressBar
          value={stat.progress_percentage}
          showLabel={false}
          size="sm"
        />
      </div>
    </div>
  );
};
