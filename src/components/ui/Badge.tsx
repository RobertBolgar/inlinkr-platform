import React from 'react';

type BadgeVariant = 
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'placement-blue'
  | 'placement-green'
  | 'placement-amber'
  | 'placement-purple'
  | 'placement-cyan'
  | 'placement-gray'
  | 'top'
  | 'branded'
  | 'disabled'
  | 'count'
  | 'snapshot'
  | 'live';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

/**
 * Reusable Badge component for consistent status indicators and labels
 * 
 * Variants:
 * - default: Gray neutral badge
 * - success: Green for positive states
 * - warning: Amber/Orange for caution states
 * - danger: Red for error/negative states
 * - info: Blue for informational states
 * - placement-*: Color-coded placement type badges
 * - top: Green badge for top performers
 * - branded: Purple badge for branded links
 * - disabled: Amber badge for disabled states
 * - count: Gray badge for numeric counts
 * - snapshot: Emerald badge for snapshot proofs
 * - live: Blue badge for live proofs
 * 
 * Sizes:
 * - sm: Compact (text-[10px], px-1.5 py-0.5)
 * - md: Standard (text-[10px], px-2 py-0.5)
 */
export function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm', 
  className = '' 
}: BadgeProps) {
  const baseClassName = "inline-flex items-center font-medium border transition-all duration-200";
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] rounded',
    md: 'px-2 py-0.5 text-[10px] rounded-md',
  };
  
  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-gray-800 border-gray-700 text-gray-400',
    success: 'bg-green-900/30 border-green-700/50 text-green-300',
    warning: 'bg-amber-900/30 border-amber-700/50 text-amber-300',
    danger: 'bg-red-900/30 border-red-700/50 text-red-300',
    info: 'bg-blue-900/30 border-blue-700/50 text-blue-300',
    'placement-blue': 'bg-blue-900/30 border-blue-700/50 text-blue-300',
    'placement-green': 'bg-green-900/30 border-green-700/50 text-green-300',
    'placement-amber': 'bg-amber-900/30 border-amber-700/50 text-amber-300',
    'placement-purple': 'bg-purple-900/30 border-purple-700/50 text-purple-300',
    'placement-cyan': 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300',
    'placement-gray': 'bg-gray-800 border-gray-700 text-gray-400',
    top: 'bg-green-900/30 border-green-700/40 text-green-400',
    branded: 'bg-purple-900/20 border-purple-800/50 text-purple-300',
    disabled: 'bg-amber-950/80 text-amber-300 border border-amber-800/40',
    count: 'bg-gray-950/80 text-gray-300 border border-gray-800/50',
    snapshot: 'bg-emerald-950/90 text-emerald-300 border border-emerald-800/50',
    live: 'bg-blue-950/90 text-blue-300 border border-blue-800/50',
  };
  
  return (
    <span className={`${baseClassName} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
