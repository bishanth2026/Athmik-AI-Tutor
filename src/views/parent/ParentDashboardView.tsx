import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StudentCard } from '../../components/parent/StudentCard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Button } from '../../components/common/Button';
import { learningMemoryService } from '../../services/learningMemoryService';
import {
  StudentLearningProfile,
  TopicMastery,
  MistakeRecord,
} from '../../types';
import {
  BookOpen,
  ListOrdered,
  TrendingUp,
  Clock,
  ArrowRight,
  Settings,
  Plus,
  Database,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sliders,
  X,
  Target,
} from 'lucide-react';

interface ParentDashboardViewProps {
  onNavigate: (path: string) => void;
}

export const ParentDashboardView: React.FC<ParentDashboardViewProps> = ({ onNavigate }) => {
  const { student, parent, subjects, activeSubjects, chapters, overallProgress } = useApp();

  const [profile, setProfile] = useState<StudentLearningProfile | null>(null);
  const [topicMasteries, setTopicMasteries] = useState<TopicMastery[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [isControlsModalOpen, setIsControlsModalOpen] = useState(false);

  // Settings form state
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(20);
  const [preferredDiff, setPreferredDiff] = useState(2);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadParentData = async () => {
      try {
        const [prof, masteries, studentMistakes] = await Promise.all([
          learningMemoryService.getStudentProfile(student.id),
          learningMemoryService.getAllTopicMasteries(student.id),
          learningMemoryService.getMistakes(student.id),
        ]);
        if (isMounted) {
          setProfile(prof);
          setTopicMasteries(masteries);
          setMistakes(studentMistakes);
          if (prof) {
            setDailyGoalMinutes(prof.daily_study_goal_minutes || 20);
            setPreferredDiff(prof.preferred_difficulty || 2);
          }
        }
      } catch (err) {
        console.error('Failed to load parent dashboard learning data', err);
      }
    };
    loadParentData();
    return () => {
      isMounted = false;
    };
  }, [student.id]);

  const strongTopics = topicMasteries.filter((m) => m.mastery_score >= 80);
  const weakTopics = topicMasteries.filter((m) => m.mastery_score < 60 && m.questions_attempted > 0);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    const updated = await learningMemoryService.updateParentSettings(student.id, {
      daily_study_goal_minutes: dailyGoalMinutes,
      preferred_difficulty: preferredDiff,
    });
    if (updated) {
      setProfile(updated);
    }
    setIsSavingSettings(false);
    setIsControlsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Parent Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1">
            Parent Overview · Adaptive Learning
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Welcome back, {parent.name.split(' ')[0]}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Monitoring Athmik&apos;s Class 5 CBSE curriculum coverage and adaptive mastery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Sliders className="w-3.5 h-3.5 text-indigo-600" />}
            onClick={() => setIsControlsModalOpen(true)}
          >
            Study Controls
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Database className="w-3.5 h-3.5 text-indigo-600" />}
            onClick={() => onNavigate('/parent/knowledge')}
          >
            Knowledge Base
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('/parent/progress')}
          >
            Detailed Analytics
          </Button>
        </div>
      </div>

      {/* Student Profile Card */}
      <StudentCard student={student} onEdit={() => onNavigate('/parent/student')} />

      {/* SECTION 23: LEARNING OVERVIEW CARDS (Real data only, no fake metrics) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Learning Overview & Daily Signals
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Card 1: Real Study Time */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Study Time
                </span>
                <Clock className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
                {profile ? Math.round(profile.total_study_time_seconds / 60) : 0} <span className="text-xs font-semibold text-slate-500">mins</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Goal: {profile?.daily_study_goal_minutes || 20}m/day
              </p>
            </div>
          </div>

          {/* Card 2: Questions Practised */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Questions Practised
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
                {profile?.total_questions || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {profile?.total_correct || 0} answered correctly
              </p>
            </div>
          </div>

          {/* Card 3: Adaptive Mastery */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Overall Mastery
                </span>
                <Target className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-indigo-600 font-mono">
                {profile?.overall_mastery || 0}%
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Multi-signal calculated
              </p>
            </div>
          </div>

          {/* Card 4: Learning Streak */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Learning Streak
                </span>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
                {profile?.current_streak || 0} <span className="text-xs font-semibold text-slate-500">days</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Consecutive study days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* STRONG TOPICS vs TOPICS NEEDING PRACTICE (Section 25 & 26) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strong Topics */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <span>🌟 Strong Topics (Mastery ≥ 80%)</span>
            </h4>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {strongTopics.length}
            </span>
          </div>

          {strongTopics.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No topics above 80% mastery yet. They will appear as Athmik practices with the AI Tutor.
            </p>
          ) : (
            <div className="space-y-2">
              {strongTopics.map((t) => (
                <div key={t.id} className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-950 truncate">{t.topic}</span>
                  <span className="font-mono font-bold text-emerald-700">{t.mastery_score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topics Needing Practice */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span>🎯 Topics Needing Practice (&lt; 60%)</span>
            </h4>
            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {weakTopics.length}
            </span>
          </div>

          {weakTopics.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No weak topics currently flagged. Athmik is keeping up with his syllabus.
            </p>
          ) : (
            <div className="space-y-2">
              {weakTopics.map((t) => (
                <div key={t.id} className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-950 truncate">{t.topic}</span>
                  <span className="font-mono font-bold text-amber-700">{t.mastery_score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Curriculum Coverage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {/* Card: Subjects */}
        <div
          onClick={() => onNavigate('/parent/subjects')}
          className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Subjects
              </span>
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {activeSubjects.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active out of {subjects.length} configured
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>Manage subjects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card: Chapters */}
        <div
          onClick={() => onNavigate('/parent/chapters')}
          className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Chapters
              </span>
              <ListOrdered className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {chapters.filter((c) => c.active).length}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active curriculum chapters
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>Manage chapters</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* PARENT CONTROLS MODAL (Section 31) */}
      {isControlsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Parent Study Controls</h3>
                  <p className="text-xs text-slate-500">Configure daily goals and difficulty limits</p>
                </div>
              </div>
              <button
                onClick={() => setIsControlsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Daily Study Goal (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={dailyGoalMinutes}
                  onChange={(e) => setDailyGoalMinutes(parseInt(e.target.value, 10) || 20)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Recommended for Class 5: 15 to 30 minutes daily.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial / Preferred Difficulty
                </label>
                <select
                  value={preferredDiff}
                  onChange={(e) => setPreferredDiff(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="1">Level 1 — Basic (Foundational)</option>
                  <option value="2">Level 2 — Easy (Standard Class 5)</option>
                  <option value="3">Level 3 — Medium (Developing)</option>
                  <option value="4">Level 4 — Challenging (Advanced)</option>
                  <option value="5">Level 5 — Olympiad / High Concept</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  The AI Tutor adapts up and down automatically during live practice.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsControlsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 cursor-pointer"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
