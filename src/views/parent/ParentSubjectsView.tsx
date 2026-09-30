import React from 'react';
import { SubjectManager } from '../../components/parent/SubjectManager';

interface ParentSubjectsViewProps {
  onNavigate: (path: string) => void;
}

export const ParentSubjectsView: React.FC<ParentSubjectsViewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <SubjectManager
        onSelectSubject={(subjectId) => onNavigate(`/parent/chapters?subject=${subjectId}`)}
      />
    </div>
  );
};
