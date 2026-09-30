import React from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: { value: string | number; label: string }[];
  rows?: number;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  required = false,
  disabled = false,
  placeholder,
  options = [],
  rows = 3,
}) => {
  const baseInputStyles =
    'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all disabled:bg-slate-50 disabled:text-slate-500';

  const stateStyles = error
    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
    : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 hover:border-slate-300';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="block text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
        </label>
        {hint && !error && <span className="text-xs text-slate-400">{hint}</span>}
      </div>

      {type === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`${baseInputStyles} ${stateStyles} cursor-pointer`}
          required={required}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          className={`${baseInputStyles} ${stateStyles} resize-y min-h-[80px]`}
          required={required}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`${baseInputStyles} ${stateStyles}`}
          required={required}
        />
      )}

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
};
