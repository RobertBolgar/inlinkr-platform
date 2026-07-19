import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

/**
 * Standard textarea with consistent styling
 */
export function Textarea({ 
  label, 
  helperText, 
  error, 
  fullWidth = true, 
  className = '', 
  id,
  ...props 
}: TextareaProps) {
  const baseClassName = "min-h-24 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-text placeholder:text-text-subtle transition-all duration-200 focus:border-primary focus:outline-none focus:ring-0 resize-none";
  const widthClass = fullWidth ? 'w-full' : '';
  const errorClass = error ? 'border-red-500/70 focus:border-red-500' : '';
  
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={id} className="block text-xs text-gray-500 mb-1.5">
          {label}
        </label>
      )}
      <textarea
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
