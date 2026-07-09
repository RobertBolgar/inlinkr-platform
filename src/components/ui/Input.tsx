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
  const baseClassName = "px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 text-sm transition-all";
  const widthClass = fullWidth ? 'w-full' : '';
  const errorClass = error ? 'border-red-700 focus:ring-red-500/60 focus:border-red-600' : '';
  
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
