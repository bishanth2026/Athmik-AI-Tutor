import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';

interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentPath, onNavigate, children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-900 overflow-x-hidden">
      {/* 3-Zone Top Header */}
      <Header currentPath={currentPath} onNavigate={onNavigate} />

      {/* Main Container */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar currentPath={currentPath} onNavigate={onNavigate} />

        {/* Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Safe Area Aware) */}
      <MobileBottomNav currentPath={currentPath} onNavigate={onNavigate} />
    </div>
  );
};
