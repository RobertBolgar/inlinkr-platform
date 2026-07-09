import { getPlacementMetadata } from '../../lib/placement-intelligence';

type PlacementBehaviorHintProps = {
  placementType?: string | null;
};

export function PlacementBehaviorHint({ placementType }: PlacementBehaviorHintProps) {
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

  return (
    <div className="mt-3 p-3 bg-gray-900/50 border border-gray-800 rounded-lg space-y-2.5 transition-all duration-200">
      {/* Header: Label + Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">{metadata.label}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all duration-200 ${badgeClass}`}>
          {metadata.badgeLabel}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed">{metadata.description}</p>

      {/* Best For */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-1.5">
          Best for
        </div>
        <div className="flex flex-wrap gap-1.5">
          {metadata.bestUseCases.slice(0, 4).map((useCase) => (
            <span
              key={useCase}
              className="px-2 py-0.5 bg-gray-800 border border-gray-700/60 rounded text-[10px] text-gray-400 transition-all duration-200"
            >
              {useCase}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
