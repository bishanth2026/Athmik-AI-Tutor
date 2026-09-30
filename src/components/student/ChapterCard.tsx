import React from 'react';
import { Chapter, ProgressStatus } from '../../types';
import { CheckCircle2, Clock, CircleDot, ChevronRight } from 'lucide-react';

interface ChapterCardProps {
  chapter: Chapter;
  status: ProgressStatus;
  masteryScore?: number;
  onClick: () => void;
}

export const ChapterCard: React.FC<ChapterCardProps> = ({
  chapter,
  status,
  masteryScore = 0,
  onClick,
}) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'completed':
        return {
          label: 'Completed',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          icon: <Clock className="w-4 h-4 text-amber-600" />,
          badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
        };
      default:
        return {
          label: 'Not Started',
          icon: <CircleDot className="w-4 h-4 text-slate-400" />,
          badgeClass: 'text-slate-600 bg-slate-100 border-slate-200',
        };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:border-indigo-400 hover:shadow-xs transition-all duration-150 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-700 font-mono tabular-nums font-bold text-sm flex items-center justify-center shrink-0 transition-colors mt-0.5">
          {chapter.chapter_number}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-slate-400">
              Chapter {chapter.chapter_number}
            </span>
          </div>
          <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
            {chapter.chapter_name}
          </h4>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {chapter.description || 'CBSE curriculum learning chapter.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border">
          {statusInfo.icon}
          <span className="text-slate-700">{statusInfo.label}</span>
          {status === 'completed' && masteryScore > 0 && (
            <span className="font-mono tabular-nums text-slate-500 ml-1">· {masteryScore}%</span>
          )}
        </div>

        <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
          <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
};
