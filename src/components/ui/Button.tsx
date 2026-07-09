import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
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
  const baseClassName = "text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-white font-medium',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
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
