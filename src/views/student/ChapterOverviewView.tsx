import React from 'react';
import { useApp } from '../../context/AppContext';
import { LessonPlaceholder } from '../../components/student/LessonPlaceholder';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { BookOpen, ArrowLeft } from 'lucide-react';

interface ChapterOverviewViewProps {
  chapterId: string;
  onNavigate: (path: string) => void;
}

export const ChapterOverviewView: React.FC<ChapterOverviewViewProps> = ({
  chapterId,
  onNavigate,
}) => {
  const { chapters, subjects } = useApp();

  const chapter = chapters.find((c) => c.id === chapterId);
  const subject = chapter ? subjects.find((s) => s.id === chapter.subject_id) : undefined;

  if (!chapter || !subject) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => onNavigate('/student/subjects')}
        >
          Back to Subjects
        </Button>
        <EmptyState
          icon={BookOpen}
          title="Chapter not found"
          description="The requested chapter could not be found in your curriculum."
          actionText="View Subjects"
          onAction={() => onNavigate('/student/subjects')}
        />
      </div>
    );
  }

  return (
    <LessonPlaceholder
      subject={subject}
      chapter={chapter}
      onBack={() => onNavigate(`/student/subjects/${subject.id}`)}
      onOpenTutor={() => onNavigate(`/student/tutor?subject=${subject.id}&chapter=${chapter.id}`)}
    />
  );
};
