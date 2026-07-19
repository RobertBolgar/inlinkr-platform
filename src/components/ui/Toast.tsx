import { CheckCircle2, XCircle } from 'lucide-react';

interface ToastProps {
  visible: boolean;
  variant: 'success' | 'error';
  message: string;
}

export function Toast({ visible, variant, message }: ToastProps) {
  if (!visible) return null;

  return (
    <div
      className={`animate-ink-enter fixed top-4 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-ink-lg pointer-events-none select-none ${
        variant === 'success'
          ? 'border-emerald-800/60 bg-emerald-950/95 text-emerald-200'
          : 'border-red-800/60 bg-red-950/95 text-red-200'
      }`}
    >
      {variant === 'success' ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" />
      )}
      <span className="whitespace-nowrap">{message}</span>
    </div>
  );
}
