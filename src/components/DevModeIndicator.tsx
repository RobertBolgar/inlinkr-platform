import { isDevAuthEnabled } from '../lib/auth/dev';

export function DevModeIndicator() {
  if (!isDevAuthEnabled) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50">
      <div className="px-2.5 py-1 rounded-md bg-amber-500/90 text-black text-[10px] font-bold tracking-wide shadow-lg">
        Development Mode
      </div>
    </div>
  );
}
