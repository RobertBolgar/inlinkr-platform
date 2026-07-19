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
  const baseClasses = "rounded-lg border px-3.5 py-3 text-sm leading-5";
  
  const variantClasses = {
    error: 'border-red-800/60 bg-red-950/45 text-red-200',
    warning: 'border-amber-800/60 bg-amber-950/35 text-amber-200',
    success: 'border-emerald-800/60 bg-emerald-950/35 text-emerald-200',
    info: 'border-blue-800/60 bg-blue-950/35 text-blue-200',
  };
  
  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
