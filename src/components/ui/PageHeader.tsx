
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/**
 * Standard page header with title and optional subtitle
 */
export function PageHeader({ title, subtitle, className = '' }: PageHeaderProps) {
  return (
    <div className={className}>
      <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
      {subtitle && (
        <p className="text-gray-500 mt-0.5 text-sm">{subtitle}</p>
      )}
    </div>
  );
}
