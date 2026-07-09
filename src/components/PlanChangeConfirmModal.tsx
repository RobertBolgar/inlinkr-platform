import { X } from 'lucide-react';

interface PlanChangeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentPlan: string;
  newPlan: string;
  billingInterval: string;
  isProToProPlus: boolean;
}

export function PlanChangeConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  currentPlan,
  newPlan,
  billingInterval,
}: PlanChangeConfirmModalProps) {
  if (!isOpen) return null;

  const formatPlanName = (plan: string) => {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

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

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Confirm plan change
            </h2>
            
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current plan:</span>
                <span className="text-white font-medium">{formatPlanName(currentPlan)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">New plan:</span>
                <span className="text-blue-400 font-medium">{formatPlanName(newPlan)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Billing:</span>
                <span className="text-white font-medium capitalize">{billingInterval}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-gray-300 mb-4">
              Your subscription will be updated immediately through Stripe.
            </p>
            
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Confirm change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
