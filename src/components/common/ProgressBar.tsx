import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  labelPrefix?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  showLabel = true,
  size = 'md',
  labelPrefix = 'Progress',
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  const getColor = (pct: number) => {
    if (pct >= 100) return 'bg-emerald-600';
    if (pct > 0) return 'bg-indigo-600';
    return 'bg-slate-300';
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5 font-medium">
          <span>{labelPrefix}</span>
          <span className="font-mono tabular-nums text-slate-800 font-semibold">{clampedValue}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heightStyles[size]}`}>
        <div
          className={`h-full transition-all duration-300 rounded-full ${getColor(clampedValue)}`}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};
