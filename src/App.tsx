import React, { lazy, Suspense, useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/common/AppShell';
import { AuthGate } from './components/common/AuthGate';

// Views
import { RoleSelectView } from './views/RoleSelectView';
import { ParentDashboardView } from './views/parent/ParentDashboardView';
import { StudentProfileView } from './views/parent/StudentProfileView';
import { ParentSubjectsView } from './views/parent/ParentSubjectsView';
import { ParentChaptersView } from './views/parent/ParentChaptersView';
import { ParentProgressView } from './views/parent/ParentProgressView';
import { ParentSettingsView } from './views/parent/ParentSettingsView';
import { ParentKnowledgeView } from './views/parent/ParentKnowledgeView';

import { StudentDashboardView } from './views/student/StudentDashboardView';
import { StudentSubjectsView } from './views/student/StudentSubjectsView';
import { SubjectOverviewView } from './views/student/SubjectOverviewView';
import { ChapterOverviewView } from './views/student/ChapterOverviewView';
import { StudentProgressView } from './views/student/StudentProgressView';
import { StudentProfileReadOnlyView } from './views/student/StudentProfileReadOnlyView';
import { AITutorFoundationView } from './views/student/AITutorFoundationView';
const AIAssistantView = lazy(() => import('./views/student/AIAssistantView').then((module) => ({ default: module.AIAssistantView })));

function MainRouter() {
  const { role, setRole } = useApp();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path.split('?')[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectRole = (newRole: 'parent' | 'student') => {
    setRole(newRole);
    if (newRole === 'parent') {
      navigate('/parent');
    } else {
      navigate('/student');
    }
  };

  const renderCurrentView = () => {
    if (currentPath === '/' || currentPath === '/login') return <RoleSelectView onSelectRole={handleSelectRole} />;
    if (currentPath === '/parent') return <ParentDashboardView onNavigate={navigate} />;
    if (currentPath === '/parent/knowledge') return <ParentKnowledgeView onNavigate={navigate} />;
    if (currentPath === '/parent/student') return <StudentProfileView />;
    if (currentPath === '/parent/subjects') return <ParentSubjectsView onNavigate={navigate} />;
    if (currentPath.startsWith('/parent/chapters')) {
      const urlParams = new URLSearchParams(window.location.search);
      const subjectId = urlParams.get('subject') || undefined;
      return <ParentChaptersView subjectId={subjectId} />;
    }
    if (currentPath === '/parent/progress') return <ParentProgressView />;
    if (currentPath === '/parent/settings') return <ParentSettingsView onNavigate={navigate} />;
    if (currentPath === '/student') return <StudentDashboardView onNavigate={navigate} />;
    if (currentPath === '/student/subjects') return <StudentSubjectsView onNavigate={navigate} />;
    if (currentPath.startsWith('/student/subjects/')) {
      const subjectId = currentPath.replace('/student/subjects/', '');
      return <SubjectOverviewView subjectId={subjectId} onNavigate={navigate} />;
    }
    if (currentPath.startsWith('/student/chapters/')) {
      const chapterId = currentPath.replace('/student/chapters/', '');
      return <ChapterOverviewView chapterId={chapterId} onNavigate={navigate} />;
    }
    if (currentPath === '/student/progress') return <StudentProgressView onNavigate={navigate} />;
    if (currentPath === '/student/profile') return <StudentProfileReadOnlyView onNavigate={navigate} />;
    if (currentPath === '/student/tutor' || currentPath.startsWith('/student/tutor')) return <AITutorFoundationView onNavigate={navigate} />;
    if (currentPath === '/student/assistant' || currentPath.startsWith('/student/assistant')) return (
      <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-500">Loading AI Assistant…</div>}>
        <AIAssistantView />
      </Suspense>
    );
    if (role === 'parent') return <ParentDashboardView onNavigate={navigate} />;
    return <StudentDashboardView onNavigate={navigate} />;
  };

  return <AppShell currentPath={currentPath} onNavigate={navigate}>{renderCurrentView()}</AppShell>;
}

export default function App() {
  return <AuthGate><AppProvider><MainRouter /></AppProvider></AuthGate>;
}