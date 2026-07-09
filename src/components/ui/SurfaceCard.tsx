import React from 'react';

interface SurfaceCardProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Standard surface card with consistent border and background
 * - sm: p-4
 * - md: p-4 sm:p-5
 * - lg: p-5
 */
export function SurfaceCard({ children, padding = 'md', className = '' }: SurfaceCardProps) {
  const paddingClass = {
    sm: 'p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5',
  }[padding];

  return (
    <div className={`bg-gray-900 border border-gray-800/80 rounded-xl ${paddingClass} ${className}`}>
      {children}
    </div>
  );
}
