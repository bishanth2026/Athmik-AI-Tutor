import React, { useState } from 'react';
import { Subject, Chapter, ProgressStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { progressService } from '../../services/progressService';
import { Button } from '../common/Button';
import { SubjectIcon } from '../common/SubjectIcon';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  Clock,
  CircleDot,
  RotateCcw,
  Layers,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';

interface LessonPlaceholderProps {
  subject: Subject;
  chapter: Chapter;
  onBack: () => void;
  onOpenTutor?: () => void;
}

export const LessonPlaceholder: React.FC<LessonPlaceholderProps> = ({
  subject,
  chapter,
  onBack,
  onOpenTutor,
}) => {
  const { student, refreshData } = useApp();
  const currentProgress = progressService.getChapterStatus(student.id, chapter.id);

  const [status, setStatus] = useState<ProgressStatus>(currentProgress.status);
  const [mastery, setMastery] = useState<number>(currentProgress.masteryScore || 85);
  const [activeTab, setActiveTab] = useState<'overview' | 'learning_session' | 'practice'>('overview');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleUpdateStatus = (newStatus: ProgressStatus, newMastery: number = 85) => {
    progressService.updateChapterStatus(
      student.id,
      subject.id,
      chapter.id,
      newStatus,
      newMastery,
      `Chapter ${chapter.chapter_number}: ${chapter.chapter_name}`
    );
    setStatus(newStatus);
    setMastery(newMastery);
    refreshData();

    if (newStatus === 'completed') {
      setFeedbackMsg('Great job Athmik! Chapter marked as completed and stored in your learning record.');
    } else if (newStatus === 'in_progress') {
      setFeedbackMsg('Learning session recorded! Your progress is now in progress.');
    } else {
      setFeedbackMsg('Status reset to not started.');
    }

    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
            {mastery > 0 && <span className="font-mono tabular-nums">({mastery}%)</span>}
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            <span>In Progress</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
            <CircleDot className="w-3.5 h-3.5" />
            <span>Not Started</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Back to {subject.name}
        </Button>
      </div>

      {/* Chapter Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <SubjectIcon name={subject.icon} className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
                <span>{subject.name}</span>
                <span aria-hidden="true">·</span>
                <span>Chapter {chapter.chapter_number}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {chapter.chapter_name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed max-w-2xl">
                {chapter.description}
              </p>
            </div>
          </div>

          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Action Buttons: Start Learning / Continue / Practice / AI Tutor */}
        <div className="pt-6 flex flex-wrap items-center gap-3">
          {onOpenTutor && (
            <Button
              variant="primary"
              size="lg"
              icon={<Sparkles className="w-4 h-4 text-amber-300" />}
              onClick={onOpenTutor}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25"
            >
              Teach Me with AI Tutor
            </Button>
          )}

          {status === 'not_started' ? (
            <Button
              variant={onOpenTutor ? 'secondary' : 'primary'}
              size="lg"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={() => {
                setActiveTab('learning_session');
                handleUpdateStatus('in_progress');
              }}
            >
              Start Learning
            </Button>
          ) : (
            <Button
              variant={onOpenTutor ? 'secondary' : 'primary'}
              size="lg"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={() => setActiveTab('learning_session')}
            >
              Continue Learning
            </Button>
          )}

          <Button
            variant="secondary"
            size="lg"
            icon={<HelpCircle className="w-4 h-4" />}
            onClick={() => setActiveTab('practice')}
          >
            Practice Exercises
          </Button>

          {status !== 'completed' ? (
            <Button
              variant="outline"
              size="lg"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              onClick={() => handleUpdateStatus('completed', 90)}
            >
              Mark Completed
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              icon={<RotateCcw className="w-4 h-4 text-slate-500" />}
              onClick={() => handleUpdateStatus('not_started', 0)}
            >
              Reset Status
            </Button>
          )}
        </div>

        {feedbackMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'overview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Curriculum Overview
        </button>
        <button
          onClick={() => setActiveTab('learning_session')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'learning_session' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Learning Workspace
        </button>
        <button
          onClick={() => setActiveTab('practice')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'practice' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Practice & Quiz
        </button>
      </div>

      {/* Content depending on active tab */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Curriculum Objectives & Focus</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This chapter covers core Class 5 CBSE principles. In Module 1, the syllabus hierarchy,
              student association, and progress tracking are completely active and persistent.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Board & Class</span>
              <p className="text-sm font-bold text-slate-800">CBSE Class 5 Curriculum</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Learning Style</span>
              <p className="text-sm font-bold text-slate-800">{student.learning_preference}</p>
            </div>
          </div>

          {/* Module 1 Foundation Notice */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 text-xs text-indigo-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Foundation Architecture (Module 1)</span>
            </div>
            <p className="leading-relaxed">
              The data model is fully hooked to local persistent storage (ready for Supabase migration).
              When you click <strong>&ldquo;Mark Completed&rdquo;</strong>, your progress updates immediately and persists
              across page refreshes!
            </p>
          </div>
        </div>
      )}

      {activeTab === 'learning_session' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
            <Sparkles className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Tutor Learning Space (Upcoming in Module 2)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                As specified in the development guidelines, the AI Tutoring Engine, RAG ingestion, and Voice AI
                will be connected in Module 2. We do NOT simulate fake AI chat messages.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-slate-800">Chapter Learning Controls</h4>
            <p className="text-xs text-slate-500">
              You can test the real progress calculation and persistence right now:
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={status === 'in_progress' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleUpdateStatus('in_progress')}
              >
                Set Status: In Progress
              </Button>
              <Button
                variant={status === 'completed' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleUpdateStatus('completed', 90)}
              >
                Set Status: Completed (90% Mastery)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus('not_started', 0)}
              >
                Reset to Not Started
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'practice' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-center space-y-4">
          <HelpCircle className="w-10 h-10 text-indigo-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Practice & Adaptive Quiz Engine</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Practice questions generated dynamically based on CBSE Class 5 question banks will be activated in Module 2.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus('completed', 95)}
            >
              Simulate Quiz Pass & Complete Chapter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
