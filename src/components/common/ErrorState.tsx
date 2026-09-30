import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = "We couldn't load this information. Please try again.",
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-rose-200 bg-rose-50/40 text-slate-800 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 max-w-sm mb-5 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
};
