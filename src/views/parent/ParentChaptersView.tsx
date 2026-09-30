import React from 'react';
import { ChapterManager } from '../../components/parent/ChapterManager';

interface ParentChaptersViewProps {
  subjectId?: string;
}

export const ParentChaptersView: React.FC<ParentChaptersViewProps> = ({ subjectId }) => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <ChapterManager initialSubjectId={subjectId} />
    </div>
  );
};
