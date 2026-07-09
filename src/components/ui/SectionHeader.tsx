
interface SectionHeaderProps {
  label: string;
  description?: string;
  spacing?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Standard section header with uppercase label and optional description
 * - sm: mb-2
 * - md: mb-3
 * - lg: mb-4
 */
export function SectionHeader({ label, description, spacing = 'md', className = '' }: SectionHeaderProps) {
  const spacingClass = {
    sm: 'mb-2',
    md: 'mb-3',
    lg: 'mb-4',
  }[spacing];

  return (
    <div className={className}>
      <div className={`text-xs font-semibold text-gray-400 uppercase tracking-wide ${spacingClass}`}>
        {label}
      </div>
      {description && (
        <div className="text-xs text-gray-600 mt-0.5">{description}</div>
      )}
    </div>
  );
}
