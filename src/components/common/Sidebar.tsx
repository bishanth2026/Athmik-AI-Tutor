import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  User,
  BookOpen,
  ListOrdered,
  TrendingUp,
  Settings,
  Sparkles,
  Award,
  ChevronRight,
  Database,
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { role, student } = useApp();

  const parentNavItems = [
    { label: 'Dashboard', path: '/parent', icon: LayoutDashboard },
    { label: 'Knowledge Base', path: '/parent/knowledge', icon: Database },
    { label: 'Student Profile', path: '/parent/student', icon: User },
    { label: 'Subjects', path: '/parent/subjects', icon: BookOpen },
    { label: 'Chapters', path: '/parent/chapters', icon: ListOrdered },
    { label: 'Learning Progress', path: '/parent/progress', icon: TrendingUp },
    { label: 'Settings', path: '/parent/settings', icon: Settings },
  ];

  const studentNavItems = [
    { label: "Today's Learning", path: '/student', icon: LayoutDashboard },
    { label: 'My Subjects', path: '/student/subjects', icon: BookOpen },
    { label: 'My Progress', path: '/student/progress', icon: TrendingUp },
    { label: 'AI Tutor Preview', path: '/student/tutor', icon: Sparkles },
    { label: 'My Profile', path: '/student/profile', icon: User },
  ];

  const items = role === 'parent' ? parentNavItems : studentNavItems;

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4">
      {/* Student context widget */}
      <div className="p-3.5 mb-4 rounded-xl bg-slate-50 border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-base">
            {student.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-900 truncate">{student.name}</h4>
            <p className="text-xs text-slate-500 truncate">
              Class {student.class} · {student.board}
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="space-y-1 flex-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/'
              ? currentPath === '/'
              : currentPath === item.path ||
                (item.path !== '/parent' && item.path !== '/student' && currentPath.startsWith(item.path));

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Curriculum Footer marker */}
      <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
        <p className="truncate">Curriculum: CBSE Class 5</p>
        <p className="font-mono tabular-nums text-[11px] text-slate-400 mt-0.5">AY {student.academic_year}</p>
      </div>
    </aside>
  );
};
