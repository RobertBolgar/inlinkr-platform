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
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-xl pointer-events-none select-none ${
        variant === 'success'
          ? 'bg-green-950 border border-green-700/60 text-green-300'
          : 'bg-red-950 border border-red-700/60 text-red-300'
      }`}
    >
      {variant === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="whitespace-nowrap">{message}</span>
    </div>
  );
}
