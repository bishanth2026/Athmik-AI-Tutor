import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  BookOpen,
  Mic,
  Brain,
  ShieldCheck,
  CheckCircle,
  Cpu,
  Layers,
} from 'lucide-react';

export const AITutorPreview: React.FC = () => {
  const { student, activeSubjects } = useApp();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-10 shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Architecture Foundation · Module 1</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Personal AI Tutor for Athmik
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Designed specifically for CBSE Class 5 at Amrutha Public School. In Module 1, the entire
            data schema, subject hierarchy, chapter management, and persistent progress engine are active.
          </p>

          <div className="pt-2 flex flex-wrap gap-3 text-xs text-slate-300 font-medium">
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Learner: Athmik</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Style: {student.learning_preference}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Subjects: {activeSubjects.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Architecture Modules Grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">
          Upcoming AI Tutor Modules (Architecture Blueprint)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mb-6">
          Following strict development requirements, we do not show fake AI responses. The pipeline below is architected and ready for activation:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Socratic Tutoring Engine</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Never just gives direct answers. Guides Athmik with thoughtful hints, visual metaphors,
              and step-by-step reasoning tailored to a 10-year-old CBSE student.
            </p>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Service: aiTutorService.ts</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Curriculum RAG System</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Indexes official NCERT textbooks, Amrutha Public School teacher notes, and worksheets.
              All explanations ground directly in CBSE syllabus guidelines.
            </p>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Schema: knowledge_documents table</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Interactive Voice AI</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Athmik can speak aloud and hear spoken explanations in English and regional languages
              (Hindi/Malayalam pronunciation support).
            </p>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Kid-friendly conversational bounds</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Long-Term Learning Memory</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Remembers chapters Athmik found challenging, mistakes in practice questions, revision intervals,
              and preferred explanation paces.
            </p>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Schema: learning_memory table</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
