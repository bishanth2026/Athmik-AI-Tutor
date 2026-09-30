import React, { useState } from 'react';
import { AITutorAgentView } from './AITutorAgentView';
import { AITutorPreview } from '../../components/student/AITutorPreview';
import { Sparkles, Layers } from 'lucide-react';

interface AITutorFoundationViewProps {
  onNavigate?: (path: string) => void;
}

export const AITutorFoundationView: React.FC<AITutorFoundationViewProps> = ({ onNavigate }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialSubjectId = urlParams.get('subject') || undefined;
  const initialChapterId = urlParams.get('chapter') || undefined;

  const [activeTab, setActiveTab] = useState<'agent' | 'blueprint'>('agent');

  return (
    <div className="space-y-4">
      {/* Switcher between Live AI Tutor Agent and Architecture Blueprint */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-xs">
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'agent'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Tutor Agent</span>
          </button>
          <button
            onClick={() => setActiveTab('blueprint')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'blueprint'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Architecture Blueprint</span>
          </button>
        </div>
      </div>

      {activeTab === 'agent' ? (
        <AITutorAgentView
          initialSubjectId={initialSubjectId}
          initialChapterId={initialChapterId}
          onNavigate={onNavigate}
        />
      ) : (
        <AITutorPreview />
      )}
    </div>
  );
};
