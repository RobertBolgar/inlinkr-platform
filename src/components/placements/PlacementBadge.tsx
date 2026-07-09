import { getPlacementMetadata } from '../../lib/placement-intelligence';

type PlacementBadgeProps = {
  placementType?: string | null;
  compact?: boolean;
};

export function PlacementBadge({ placementType, compact = false }: PlacementBadgeProps) {
  const metadata = getPlacementMetadata(placementType);

  const badgeToneClasses: Record<string, string> = {
    blue: 'bg-blue-900/30 border-blue-700/50 text-blue-300',
    green: 'bg-green-900/30 border-green-700/50 text-green-300',
    amber: 'bg-amber-900/30 border-amber-700/50 text-amber-300',
    purple: 'bg-purple-900/30 border-purple-700/50 text-purple-300',
    cyan: 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300',
    gray: 'bg-gray-800 border-gray-700 text-gray-400',
  };

  const badgeClass = badgeToneClasses[metadata.badgeTone] || badgeToneClasses.gray;

  if (compact) {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all duration-200 ${badgeClass}`}>
        {metadata.badgeLabel}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all duration-200 ${badgeClass}`}>
      {metadata.badgeLabel}
    </span>
  );
}
