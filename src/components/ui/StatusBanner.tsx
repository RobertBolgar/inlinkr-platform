import React from 'react';

interface StatusBannerProps {
  variant?: 'error' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
  className?: string;
}

/**
 * Status banner for displaying alerts and messages
 */
export function StatusBanner({ variant = 'info', children, className = '' }: StatusBannerProps) {
  const baseClasses = "px-4 py-2.5 rounded-lg text-sm";
  
  const variantClasses = {
    error: 'bg-red-900/20 border border-red-800/50 text-red-400',
    warning: 'bg-yellow-900/20 border border-yellow-800/50 text-yellow-400',
    success: 'bg-green-900/20 border border-green-800/50 text-green-400',
    info: 'bg-blue-900/20 border border-blue-800/50 text-blue-400',
  };
  
  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
