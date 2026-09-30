import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { learningMemoryService } from '../../services/learningMemoryService';
import {
  StudentLearningProfile,
  TopicMastery,
  MistakeRecord,
} from '../../types';
import { SubjectIcon } from '../../components/common/SubjectIcon';
import { ProgressBar } from '../../components/common/ProgressBar';
import {
  TrendingUp,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  CircleDot,
  ArrowRight,
  Flame,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  Repeat,
  ShieldCheck,
} from 'lucide-react';

interface StudentProgressViewProps {
  onNavigate: (path: string) => void;
}

export const StudentProgressView: React.FC<StudentProgressViewProps> = ({ onNavigate }) => {
  const { student, activeSubjects, overallProgress, getSubjectProgress } = useApp();

  const [profile, setProfile] = useState<StudentLearningProfile | null>(null);
  const [topicMasteries, setTopicMasteries] = useState<TopicMastery[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
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
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [student.id]);

  const strongTopics = topicMasteries.filter((m) => m.mastery_score >= 80);
  const weakTopics = topicMasteries.filter((m) => m.mastery_score < 60 && m.questions_attempted > 0);

  // Helper for child-friendly mastery badge
  const getMasteryBadge = (score: number) => {
    if (score >= 90) return { label: 'Mastered 🌟', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (score >= 80) return { label: 'Strong 💪', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    if (score >= 60) return { label: 'Practising 🎯', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (score >= 40) return { label: 'Developing 📈', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { label: 'Foundational 🌱', color: 'bg-slate-100 text-slate-800 border-slate-300' };
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Athmik&apos;s Learning Tracker
          </span>
          <span className="text-xs text-slate-400">· Real Activity & Adaptive Intelligence</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          My Learning Progress
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Track what you know well, what needs practice, and your real study streak in Class 5 CBSE.
        </p>
      </div>

      {/* Main Overall Progress & Streak Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Syllabus Completion
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-slate-900 font-mono">
                {overallProgress.overall_progress_percentage}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({overallProgress.completed_chapters} of {overallProgress.total_active_chapters} chapters)
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Overall Adaptive Mastery
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-indigo-600 font-mono">
                {profile ? profile.overall_mastery : 0}%
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getMasteryBadge(profile ? profile.overall_mastery : 0).color}`}>
                {getMasteryBadge(profile ? profile.overall_mastery : 0).label}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Real Learning Streak
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-amber-600 font-mono flex items-center gap-1">
                <Flame className="w-8 h-8 fill-amber-500 text-amber-600 inline" />
                <span>{profile?.current_streak || 0}</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">consecutive study days</span>
            </div>
          </div>
        </div>

        <div>
          <ProgressBar
            value={overallProgress.overall_progress_percentage}
            labelPrefix="Total Curriculum Mastery"
            size="lg"
          />
        </div>
      </div>

      {/* TOPICS YOU KNOW WELL vs TOPICS TO PRACTISE (Section 25 & 26: Real data only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Strong Topics */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                🌟
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Topics You Know Well</h3>
                <p className="text-[11px] text-slate-400">Mastery score 80% and above</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {strongTopics.length} mastered
            </span>
          </div>

          {strongTopics.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Complete practice problems with your AI Tutor to earn strong mastery ratings here!
            </p>
          ) : (
            <div className="space-y-2.5">
              {strongTopics.map((topic) => (
                <div key={topic.id} className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-emerald-950 truncate">{topic.topic}</h4>
                    <p className="text-[11px] text-emerald-700/80">
                      {topic.correct_answers} of {topic.questions_attempted} correct · Level {topic.difficulty_level}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-700">
                    {topic.mastery_score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Weak Topics Needing Practice */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                🎯
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Topics to Practise</h3>
                <p className="text-[11px] text-slate-400">Mastery below 60% with recorded attempts</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {weakTopics.length} focus areas
            </span>
          </div>

          {weakTopics.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No weak topics detected! Keep up the great work in your daily lessons.
            </p>
          ) : (
            <div className="space-y-2.5">
              {weakTopics.map((topic) => (
                <div
                  key={topic.id}
                  onClick={() => onNavigate(`/student/tutor?subject=${topic.subject_id}&chapter=${topic.chapter_id}`)}
                  className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center justify-between hover:bg-amber-100/60 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-amber-950 truncate group-hover:text-amber-900">
                      {topic.topic}
                    </h4>
                    <p className="text-[11px] text-amber-700/80">
                      Mastery: {topic.mastery_score}% · Click to practice with AI Tutor
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MISTAKE MEMORY REVIEW LEDGER (Section 7, 8, 9) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Mistake Memory & Mastery Evidence</h3>
              <p className="text-xs text-slate-400">
                Tracking past difficulties and confirming resolution through multiple correct responses
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {mistakes.length} recorded
          </span>
        </div>

        {mistakes.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No mistakes recorded yet. As you solve questions with the AI Tutor, difficulties will be tracked here for review.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mistakes.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                  m.resolved
                    ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
                    : 'bg-rose-50/50 border-rose-200/80 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[10px]">
                    {m.mistake_type} mistake (Seen {m.frequency}x)
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    m.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {m.resolved ? '✓ Resolved' : 'Needs Practice'}
                  </span>
                </div>
                <p className="font-semibold text-xs leading-snug">{m.description}</p>
                <p className="text-[11px] text-slate-500 truncate">Topic: {m.topic}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subject-Wise Progress Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Subject Progress Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeSubjects.map((sub) => {
            const stat = getSubjectProgress(sub.id);
            if (!stat) return null;
            return (
              <div
                key={sub.id}
                onClick={() => onNavigate(`/student/subjects/${sub.id}`)}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <SubjectIcon name={sub.icon} className="w-4 h-4" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{sub.name}</h4>
                      <p className="text-[11px] text-slate-400">
                        {stat.completed_chapters} of {stat.total_chapters} chapters
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-600">
                    {stat.progress_percentage}%
                  </span>
                </div>
                <ProgressBar value={stat.progress_percentage} size="sm" showLabel={false} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
