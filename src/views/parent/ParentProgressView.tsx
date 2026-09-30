import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { learningMemoryService } from '../../services/learningMemoryService';
import {
  StudentLearningProfile,
  TopicMastery,
  MistakeRecord,
  LearningSession,
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
  BarChart2,
  AlertTriangle,
  Repeat,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const ParentProgressView: React.FC = () => {
  const { student, activeSubjects, chapters, overallProgress, getSubjectProgress } = useApp();

  const [activeTab, setActiveTab] = useState<'topicsReport' | 'curriculum'>('topicsReport');
  const [profile, setProfile] = useState<StudentLearningProfile | null>(null);
  const [topicMasteries, setTopicMasteries] = useState<TopicMastery[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    activeSubjects.length > 0 ? activeSubjects[0].id : ''
  );

  useEffect(() => {
    let isMounted = true;
    const loadReport = async () => {
      try {
        const report = await learningMemoryService.getParentReport(student.id);
        if (isMounted && report) {
          setProfile(report.profile);
          setTopicMasteries(report.allTopics || []);
          setMistakes(report.recentMistakes || []);
          setSessions(report.recentSessions || []);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load parent report', err);
        if (isMounted) setIsLoading(false);
      }
    };
    loadReport();
    return () => {
      isMounted = false;
    };
  }, [student.id]);

  const selectedSubject = activeSubjects.find((s) => s.id === selectedSubjectId) || activeSubjects[0];
  const selectedSubjectChapters = chapters.filter(
    (c) => c.subject_id === selectedSubject?.id && c.active
  );
  const selectedSubjectStat = selectedSubject ? getSubjectProgress(selectedSubject.id) : null;

  // Helper for recommendation action based on topic data (Section 24 & 28)
  const getRecommendedAction = (m: TopicMastery) => {
    if (m.mastery_score < 40) return 'Foundational lesson with real-life examples (10m)';
    if (m.mastery_score < 60) return 'Practice 5 level-appropriate questions (15m)';
    if (m.mastery_score < 80) return 'Practice 3 application problems (10m)';
    if (m.next_review_at && new Date(m.next_review_at) <= new Date()) return 'Spaced revision quiz due today';
    return 'Mastered · Ready for next chapter topic';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1">
            Learning Analytics & Adaptive Tracking
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Progress & Topic Mastery Report
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Multi-signal calculated academic performance, mistake memory, and curriculum completion for Athmik.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('topicsReport')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'topicsReport'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Topic Mastery & Mistakes
          </button>
          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'curriculum'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Curriculum Coverage
          </button>
        </div>
      </div>

      {/* Overall Progress Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Class 5 CBSE Completion
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-slate-900 font-mono tabular-nums">
                {overallProgress.overall_progress_percentage}%
              </span>
              <span className="text-xs text-slate-500">
                ({overallProgress.completed_chapters} of {overallProgress.total_active_chapters} chapters)
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Overall Adaptive Mastery
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-indigo-600 font-mono tabular-nums">
                {profile?.overall_mastery || 0}%
              </span>
              <span className="text-xs text-slate-500">
                (Multi-signal accuracy & volume)
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Verified Study Time
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-emerald-600 font-mono tabular-nums">
                {profile ? Math.round(profile.total_study_time_seconds / 60) : 0}
              </span>
              <span className="text-xs text-slate-500">
                active minutes recorded
              </span>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <ProgressBar
            value={overallProgress.overall_progress_percentage}
            labelPrefix="Total Curriculum Mastery"
            size="md"
          />
        </div>
      </div>

      {/* TAB 1: PARENT TOPIC REPORT (Section 24) */}
      {activeTab === 'topicsReport' && (
        <div className="space-y-6">
          {/* Section 24: Comprehensive Topic Mastery Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Topic Mastery & Learning Signals</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculated from recent performance, total accuracy, difficulty level, and mistake consistency
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                {topicMasteries.length} topics tracked
              </span>
            </div>

            {topicMasteries.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No topic activity recorded yet. As Athmik practices with the AI Tutor, detailed topic reports will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Subject & Chapter</th>
                      <th className="py-3 px-4">Topic</th>
                      <th className="py-3 px-4">Mastery</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Difficulty</th>
                      <th className="py-3 px-4">Last Studied</th>
                      <th className="py-3 px-4">Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topicMasteries.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <div>{m.subject_id === 'sub_maths' ? 'Mathematics' : 'Science (EVS)'}</div>
                          <div className="text-[11px] text-slate-400 font-normal">Ch 1: The Fish Tale</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {m.topic}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md ${
                            m.mastery_score >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.mastery_score >= 60
                              ? 'bg-blue-100 text-blue-800'
                              : m.mastery_score >= 40
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {m.mastery_score}% ({m.mastery_state})
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {m.status === 'mastered' ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mastered</span>
                            </span>
                          ) : m.status === 'needs_practice' ? (
                            <span className="text-amber-700 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Needs Practice</span>
                            </span>
                          ) : (
                            <span className="text-blue-700 font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Learning</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                          Level {m.difficulty_level}/5
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {new Date(m.last_attempted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-indigo-700 font-medium">
                          {getRecommendedAction(m)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 7, 8, 9: Mistake Memory Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Mistake Memory & Remediation Ledger</h3>
                  <p className="text-xs text-slate-500">
                    Active difficulties require multiple correct responses across questions before being marked resolved
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                {mistakes.filter(m => !m.resolved).length} Unresolved
              </span>
            </div>

            {mistakes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No mistakes recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mistakes.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      m.resolved
                        ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                        : 'bg-rose-50/40 border-rose-200/80 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                        {m.mistake_type} mistake · Seen {m.frequency} time{m.frequency > 1 ? 's' : ''}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        m.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.resolved ? '✓ Resolved' : `Needs Practice (${m.correct_since_mistake}/2 Correct)`}
                      </span>
                    </div>

                    <p className="font-semibold text-xs leading-relaxed">{m.description}</p>
                    {m.question && (
                      <p className="text-[11px] text-slate-500 italic bg-white/60 p-2 rounded-lg border border-slate-100">
                        Context: "{m.question.slice(0, 90)}..."
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                      <span>Topic: {m.topic}</span>
                      <span>Last seen: {new Date(m.last_seen_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CURRICULUM COVERAGE */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          {/* Subject Selector Pills */}
          <div className="flex flex-wrap gap-2">
            {activeSubjects.map((sub) => {
              const isActive = sub.id === selectedSubject?.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <SubjectIcon name={sub.icon} className="w-4 h-4" />
                  <span>{sub.name}</span>
                </button>
              );
            })}
          </div>

          {/* Chapters List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {selectedSubject?.name} Chapters Coverage
            </h3>

            <div className="space-y-3">
              {selectedSubjectChapters.map((chap) => (
                <div
                  key={chap.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600">
                        Chapter {chap.chapter_number}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {chap.chapter_name}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{chap.description}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active Syllabus</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
