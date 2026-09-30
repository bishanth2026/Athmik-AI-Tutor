import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'card-skeleton' | 'table-skeleton';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  variant = 'spinner',
}) => {
  if (variant === 'card-skeleton') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
            <div className="pt-2">
              <div className="h-2 bg-slate-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};
