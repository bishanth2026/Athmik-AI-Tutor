import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs min-h-[38px] px-3.5 py-1.5 rounded-lg gap-1.5',
    md: 'text-sm min-h-[44px] px-4 py-2 rounded-xl gap-2', // Meets 44px mobile touch hitbox
    lg: 'text-base min-h-[48px] px-6 py-2.5 rounded-xl gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 focus-visible:ring-indigo-500',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 focus-visible:ring-slate-400',
    outline:
      'bg-transparent text-slate-700 hover:bg-slate-50 border border-slate-300 focus-visible:ring-indigo-500',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20 focus-visible:ring-rose-500',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
};
