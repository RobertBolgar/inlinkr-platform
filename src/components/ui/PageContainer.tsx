import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  size?: 'narrow' | 'wide';
  className?: string;
}

/**
 * Standard page container with consistent spacing and responsive layout
 * - narrow: max-w-2xl (for forms, settings)
 * - wide: max-w-7xl (for dashboards, analytics)
 */
export function PageContainer({ children, size = 'narrow', className = '' }: PageContainerProps) {
  const maxWidthClass = size === 'wide' ? 'max-w-7xl' : 'max-w-2xl';
  
  return (
    <div className={`${maxWidthClass} mx-auto space-y-6 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
