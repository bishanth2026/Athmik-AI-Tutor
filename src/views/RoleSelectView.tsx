import React from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { GraduationCap, ShieldCheck, ArrowRight, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';

interface RoleSelectViewProps {
  onSelectRole: (role: 'parent' | 'student') => void;
}

export const RoleSelectView: React.FC<RoleSelectViewProps> = ({ onSelectRole }) => {
  const { student, activeSubjects } = useApp();

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-10">
      {/* Brand & Introduction */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Module 1 · Foundation & Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
          AthmiK AI Tutor
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Personal AI Learning Assistant designed for Class 5 CBSE. Select your role to access the personalized dashboard.
        </p>

        {/* Student metadata snippet */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-800">Student: {student.name}</span>
          <span aria-hidden="true">·</span>
          <span>Class {student.class} CBSE</span>
          <span aria-hidden="true">·</span>
          <span>Amrutha Public School, Vatakara</span>
        </div>
      </div>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Portal Card */}
        <div
          onClick={() => onSelectRole('student')}
          className="group bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 hover:border-indigo-600 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-6"
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
              <GraduationCap className="w-7 h-7" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Learner Dashboard
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">I am Athmik</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                Open your Class 5 subjects, explore chapters, start interactive lessons, and track your study milestones.
              </p>
            </div>

            <div className="space-y-2 pt-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{activeSubjects.length} Active CBSE Subjects</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Real chapter progress tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Upcoming Socratic AI Tutor preview</span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={() => onSelectRole('student')}
          >
            Enter as Student
          </Button>
        </div>

        {/* Parent Portal Card */}
        <div
          onClick={() => onSelectRole('parent')}
          className="group bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 hover:border-emerald-600 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-6"
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-colors">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Parent Portal
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">I am the Parent</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                Manage Athmik&apos;s profile, configure subjects, customize school textbook chapters, and monitor real performance.
              </p>
            </div>

            <div className="space-y-2 pt-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Edit student profile & preferences</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Enable/disable curriculum subjects</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Add textbook chapters & syllabus topics</span>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="group-hover:border-emerald-600 group-hover:text-emerald-700"
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={() => onSelectRole('parent')}
          >
            Enter Parent Portal
          </Button>
        </div>
      </div>
    </div>
  );
};
