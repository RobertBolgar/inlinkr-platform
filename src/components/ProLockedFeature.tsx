import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useAppAuth } from '../contexts/AuthContext';
import { getNextPlan } from '../lib/plan';

interface ProLockedFeatureProps {
  title: string;
  description: string;
  buttonText?: string;
  className?: string;
  icon?: ReactNode;
  embedded?: boolean;
}

export function ProLockedFeature({ title, description, buttonText, className = "", icon, embedded = false }: ProLockedFeatureProps) {
  const navigate = useNavigate();
  const { user } = useAppAuth();
  const nextPlan = getNextPlan(user);

  // Don't show upgrade UI if user is already Pro+
  if (!nextPlan) {
    return null;
  }

  const dynamicButtonText = buttonText || nextPlan.cta;

  const handleUpgradeClick = () => {
    navigate('/upgrade');
  };

  if (embedded) {
    return (
      <div className={`pt-4 border-t border-gray-800 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">{title}</h4>
        </div>
        <div className="text-sm text-gray-400 mb-3">
          {description}
        </div>
        <p className="text-xs text-gray-500 italic mb-3">
          Right now you're only seeing link clicks — not what caused them
        </p>
        <button 
          type="button"
          onClick={handleUpgradeClick}
          className="w-full px-4 py-2 bg-primary hover:bg-primary text-white text-sm font-medium rounded-lg transition-colors"
        >
          {dynamicButtonText}
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {icon}
      </div>
      <div className="text-gray-400 mb-2">
        {description}
      </div>
      <p className="text-sm text-gray-500 italic mb-4">
        Right now you're only seeing link clicks — not what caused them
      </p>
      <button 
        type="button"
        onClick={handleUpgradeClick}
        className="px-4 py-2 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
      >
        {dynamicButtonText}
      </button>
    </div>
  );
}
