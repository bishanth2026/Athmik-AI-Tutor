import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  User,
  Sparkles,
  ListOrdered,
} from 'lucide-react';

interface MobileBottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath, onNavigate }) => {
  const { role } = useApp();

  const parentTabs = [
    { label: 'Home', path: '/parent', icon: LayoutDashboard },
    { label: 'Subjects', path: '/parent/subjects', icon: BookOpen },
    { label: 'Chapters', path: '/parent/chapters', icon: ListOrdered },
    { label: 'Progress', path: '/parent/progress', icon: TrendingUp },
    { label: 'Profile', path: '/parent/student', icon: User },
  ];

  const studentTabs = [
    { label: 'Home', path: '/student', icon: LayoutDashboard },
    { label: 'Subjects', path: '/student/subjects', icon: BookOpen },
    { label: 'Progress', path: '/student/progress', icon: TrendingUp },
    { label: 'AI Tutor', path: '/student/tutor', icon: Sparkles },
    { label: 'Profile', path: '/student/profile', icon: User },
  ];

  const tabs = role === 'parent' ? parentTabs : studentTabs;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.path === '/parent' || tab.path === '/student'
              ? currentPath === tab.path
              : currentPath.startsWith(tab.path);

          return (
            <button
              key={tab.path}
              onClick={() => onNavigate(tab.path)}
              className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer py-1 ${
                isActive ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
