
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
      <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm leading-6 text-text-muted">{subtitle}</p>
      )}
    </div>
  );
}
