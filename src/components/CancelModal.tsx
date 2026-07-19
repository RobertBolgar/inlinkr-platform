import { X } from 'lucide-react';

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  plan: 'pro' | 'pro_plus';
}

export function CancelModal({ isOpen, onClose, onContinue }: CancelModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-xl font-semibold text-white mb-4">
          Before you cancel…
        </h2>

        {/* Body */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-300">
            You'll lose access to:
          </p>
          <ul className="space-y-2 text-gray-400">
            <>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Unlimited Smart Links</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Branded subdomain (username.inlinkr.com)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Creator hub</span>
                </li>
              </>
          </ul>
          <p className="text-gray-400 text-sm">
            Your standard Smart Links will continue to work.
          </p>
          <p className="text-gray-500 text-sm">
            You can always upgrade again anytime.
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
          >
            Keep my plan
          </button>
          <button
            onClick={onContinue}
            className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
          >
            Continue to cancel
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            No questions asked. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
