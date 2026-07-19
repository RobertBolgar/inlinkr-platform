import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  loading?: boolean;
}

/**
 * Standard button with consistent styling
 * - primary: blue background
 * - secondary: gray background
 * - danger: red background
 */
export function Button({ 
  variant = 'primary', 
  fullWidth = false, 
  loading = false,
  className = '', 
  children, 
  disabled,
  ...props 
}: ButtonProps) {
  const baseClassName = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ease-ink focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-45";
  
  const variantClasses = {
    primary: 'bg-primary text-white shadow-ink-sm hover:bg-primary-hover hover:shadow-ink active:translate-y-px',
    secondary: 'border border-border bg-surface-elevated text-text hover:bg-surface-hover active:translate-y-px',
    ghost: 'text-text-muted hover:bg-surface-elevated hover:text-text',
    danger: 'border border-red-800/70 bg-red-950/70 text-red-200 hover:bg-red-900/70 active:translate-y-px',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  const isDisabled = disabled || loading;
  
  return (
    <button
      className={`${baseClassName} ${variantClasses[variant]} ${widthClass} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
