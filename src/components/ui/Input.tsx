import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

/**
 * Standard input field with consistent styling
 */
export function Input({ 
  label, 
  helperText, 
  error, 
  fullWidth = true, 
  className = '', 
  id,
  ...props 
}: InputProps) {
  const baseClassName = "min-h-10 rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-text placeholder:text-text-subtle transition-all duration-200 focus:border-primary focus:outline-none focus:ring-0";
  const widthClass = fullWidth ? 'w-full' : '';
  const errorClass = error ? 'border-red-500/70 focus:border-red-500' : '';
  
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={id} className="block text-xs text-gray-500 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`${baseClassName} ${widthClass} ${errorClass} ${className}`}
        {...props}
      />
      {helperText && !error && (
        <p className="mt-1 text-xs text-gray-600">{helperText}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
