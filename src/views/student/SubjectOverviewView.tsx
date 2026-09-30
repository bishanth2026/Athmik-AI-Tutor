import React from 'react';
import { useApp } from '../../context/AppContext';
import { progressService } from '../../services/progressService';
import { ChapterCard } from '../../components/student/ChapterCard';
import { SubjectIcon } from '../../components/common/SubjectIcon';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { ArrowLeft, BookOpen, Layers } from 'lucide-react';

interface SubjectOverviewViewProps {
  subjectId: string;
  onNavigate: (path: string) => void;
}

export const SubjectOverviewView: React.FC<SubjectOverviewViewProps> = ({
  subjectId,
  onNavigate,
}) => {
  const { student, subjects, chapters, getSubjectProgress } = useApp();

  const subject = subjects.find((s) => s.id === subjectId);
  const subjectChapters = chapters
    .filter((c) => c.subject_id === subjectId && c.active)
    .sort((a, b) => a.chapter_number - b.chapter_number);

  if (!subject) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => onNavigate('/student/subjects')}>
          Back to Subjects
        </Button>
        <EmptyState
          icon={BookOpen}
          title="Subject not found"
          description="The requested subject could not be located in your active curriculum."
          actionText="View All Subjects"
          onAction={() => onNavigate('/student/subjects')}
        />
      </div>
    );
  }

  const stat = getSubjectProgress(subject.id);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => onNavigate('/student/subjects')}
        >
          Back to Subjects
        </Button>
      </div>

      {/* Subject Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
              <SubjectIcon name={subject.icon} className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1">
                Class 5 CBSE · Subject
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{subject.name}</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed max-w-2xl">
                {subject.description || 'CBSE curriculum chapters and syllabus units.'}
              </p>
            </div>
          </div>

          {/* Quick Stat Pill */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-3 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
            <span className="text-xs text-slate-400">Completion</span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              {stat.progress_percentage}%
            </span>
          </div>
        </div>

        {/* Progress Bar & Chapter Counts */}
        <div className="pt-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              {stat.completed_chapters} of {stat.total_chapters} chapters completed
            </span>
            <span className="font-mono tabular-nums text-slate-700 font-semibold">
              {stat.progress_percentage}%
            </span>
          </div>
          <ProgressBar value={stat.progress_percentage} showLabel={false} size="md" />
        </div>
      </div>

      {/* Chapter List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Chapters & Topics</h2>
          <span className="text-xs text-slate-400 font-medium">
            {subjectChapters.length} {subjectChapters.length === 1 ? 'Chapter' : 'Chapters'}
          </span>
        </div>

        {subjectChapters.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No chapters have been added for this subject yet."
            description="Your parent can configure the official chapters from your school textbook in the parent portal."
          />
        ) : (
          <div className="space-y-3">
            {subjectChapters.map((chapter) => {
              const statusInfo = progressService.getChapterStatus(student.id, chapter.id);

              return (
                <ChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  status={statusInfo.status}
                  masteryScore={statusInfo.masteryScore}
                  onClick={() => onNavigate(`/student/chapters/${chapter.id}`)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
