import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserCheck, GraduationCap, ShieldCheck, Bot } from 'lucide-react';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const { role, setRole, student } = useApp();

  const handleRoleToggle = () => {
    const nextRole = role === 'parent' ? 'student' : 'parent';
    setRole(nextRole);
    if (nextRole === 'parent') {
      onNavigate('/parent');
    } else {
      onNavigate('/student');
    }
  };

  // 3-Zone Top Bar Contract
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(role === 'parent' ? '/parent' : '/student')}
            className="text-left group cursor-pointer focus-visible:outline-none"
          >
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
              Athmik AI Tutor
            </span>
          </button>
          <span className="hidden sm:inline-block text-xs text-slate-400 font-normal">
            · Class 5 CBSE
          </span>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {role === 'parent' ? (
            <>
              <button
                onClick={() => onNavigate('/parent')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath === '/parent' ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onNavigate('/parent/student')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath === '/parent/student' ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                Student Profile
              </button>
              <button
                onClick={() => onNavigate('/parent/subjects')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath.startsWith('/parent/subjects') ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                Subjects
              </button>
              <button
                onClick={() => onNavigate('/parent/chapters')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath.startsWith('/parent/chapters') ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                Chapters
              </button>
              <button
                onClick={() => onNavigate('/parent/progress')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath === '/parent/progress' ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                Progress
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onNavigate('/student')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath === '/student' ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onNavigate('/student/subjects')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath.startsWith('/student/subjects') ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                My Subjects
              </button>
              <button
                onClick={() => onNavigate('/student/progress')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath === '/student/progress' ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                My Progress
              </button>
              <button
                onClick={() => onNavigate('/student/tutor')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath === '/student/tutor' ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                AI Tutor
              </button>
              <button
                onClick={() => onNavigate('/student/assistant')}
                className={`transition-colors cursor-pointer hover:text-slate-900 ${
                  currentPath.startsWith('/student/assistant') ? 'text-indigo-600 font-semibold' : ''
                }`}
              >
                <Bot className="inline w-3.5 h-3.5 mr-1.5" />
                AI Assistant
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Primary Actions (Role Switcher & Student Indicator) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <span>Student:</span>
            <span className="font-semibold text-slate-800">{student.name}</span>
          </div>

          {/* Interactive Role Switcher Segmented Control */}
          <button
            onClick={handleRoleToggle}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            title={`Currently in ${role === 'parent' ? 'Parent' : 'Student'} mode. Click to switch.`}
          >
            {role === 'parent' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Parent Mode</span>
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Student Mode</span>
              </>
            )}
            <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-1.5">Switch</span>
          </button>
        </div>
      </div>
    </header>
  );
};
