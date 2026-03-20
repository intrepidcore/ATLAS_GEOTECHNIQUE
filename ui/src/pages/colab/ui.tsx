import React from 'react';

export const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>{children}</span>
);

export const CollapsibleCard: React.FC<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, defaultOpen = true, children }) => (
  <details className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" open={defaultOpen}>
    <summary className="cursor-pointer list-none select-none">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <div className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Afficher / masquer</div>
      </div>
    </summary>
    <div className="p-0">{children}</div>
  </details>
);

export const Button: React.FC<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
}> = ({ variant = 'primary', size = 'md', disabled, onClick, className = '', type = 'button', children }) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-500 dark:text-slate-200 dark:hover:bg-slate-800',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<{
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}> = ({ type = 'text', placeholder, value, onChange, disabled, className = '' }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    disabled={disabled}
    className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800' : ''} ${className}`}
  />
);

export const Select: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, options, placeholder, className = '' }) => (
  <select
    value={value}
    onChange={onChange}
    className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${className}`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);
