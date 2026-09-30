import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SubjectCard } from '../../components/student/SubjectCard';
import { Button } from '../../components/common/Button';
import { learningMemoryService } from '../../services/learningMemoryService';
import { StudentLearningProfile, PlanItem } from '../../types';
import {
  Sparkles,
  BookOpen,
  TrendingUp,
  ArrowRight,
  Clock,
  Award,
  Flame,
  CheckCircle2,
  Calendar,
  Zap,
  Target,
} from 'lucide-react';

interface StudentDashboardViewProps {
  onNavigate: (path: string) => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({ onNavigate }) => {
  const { student, activeSubjects, chapters, progress, overallProgress } = useApp();

  const [profile, setProfile] = useState<StudentLearningProfile | null>(null);
  const [dailyPlan, setDailyPlan] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadStudentData = async () => {
      try {
        const [prof, plan] = await Promise.all([
          learningMemoryService.getStudentProfile(student.id),
          learningMemoryService.getDailyLearningPlan(student.id),
        ]);
        if (isMounted) {
          setProfile(prof);
          setDailyPlan(plan);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    };
    loadStudentData();
    return () => {
      isMounted = false;
    };
  }, [student.id]);

  // Find if there is a chapter currently in progress
  const inProgressRecord = progress.find((p) => p.status === 'in_progress');
  const inProgressChapter = inProgressRecord
    ? chapters.find((c) => c.id === inProgressRecord.chapter_id)
    : null;
  const inProgressSubject = inProgressChapter
    ? activeSubjects.find((s) => s.id === inProgressChapter.subject_id)
    : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Student Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Class 5 CBSE Student Portal
            </span>
            {profile && profile.current_streak > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>{profile.current_streak} Day Streak!</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Hi {student.name}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ready to explore your personalized Class 5 CBSE lessons today?
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('/student/progress')}
          >
            My Progress ({profile ? profile.overall_mastery : overallProgress.overall_progress_percentage}%)
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('/student/tutor')}
          >
            AI Tutor
          </Button>
        </div>
      </div>

      {/* Real Activity & Learning Stats Bar (Section 3, 21, 22: No fake data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Learning Streak</span>
            <Flame className={`w-4 h-4 ${profile && profile.current_streak > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {profile?.current_streak || 0} <span className="text-xs font-semibold text-slate-500">days</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Real practice days</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Study Time</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {profile ? Math.round(profile.total_study_time_seconds / 60) : 0} <span className="text-xs font-semibold text-slate-500">mins</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Active session time</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Questions Solved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {profile?.total_questions || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {profile?.total_correct || 0} correct answers
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Adaptive Level</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            Level {profile?.preferred_difficulty || 2} <span className="text-xs font-semibold text-slate-500">of 5</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Dynamic challenge</p>
        </div>
      </div>

      {/* TODAY'S LEARNING PLAN (Section 30: Generated from real learning data) */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Today&apos;s Learning Plan</h2>
              <p className="text-xs text-indigo-200">
                Personalized for Athmik based on textbook materials and recent progress
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('/student/tutor')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-indigo-900 text-xs font-bold hover:bg-indigo-50 transition-colors cursor-pointer"
          >
            <span>Start Tutor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {dailyPlan.slice(0, 4).map((item, idx) => (
            <div
              key={item.id}
              onClick={() => onNavigate(`/student/tutor?subject=${item.subject_id}&chapter=${item.chapter_id}`)}
              className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl p-4 transition-all cursor-pointer flex items-start gap-3.5 group"
            >
              <span className="w-7 h-7 rounded-lg bg-indigo-500/40 text-indigo-200 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-200 transition-colors">
                    {item.title}
                  </h4>
                  <span className="text-[10px] font-mono text-indigo-300 shrink-0 font-semibold">
                    ~{item.estimated_minutes}m
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200/80 line-clamp-1">
                  {item.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Continue Learning / Hero Banner */}
      {inProgressChapter && inProgressSubject ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>In-Progress Chapter</span>
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {inProgressSubject.name} · Chapter {inProgressChapter.chapter_number}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 line-clamp-1">
              {inProgressChapter.chapter_name}: {inProgressChapter.description}
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={() => onNavigate(`/student/chapters/${inProgressChapter.id}`)}
          >
            Continue Chapter
          </Button>
        </div>
      ) : null}

      {/* Section: My Subjects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">My Subjects</h2>
            <p className="text-xs text-slate-500">Class 5 CBSE Active Subjects</p>
          </div>
          <button
            onClick={() => onNavigate('/student/subjects')}
            className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSubjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onClick={() => onNavigate(`/student/subjects/${subject.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
