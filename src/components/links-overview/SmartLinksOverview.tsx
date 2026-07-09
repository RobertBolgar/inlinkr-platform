import { Calendar } from 'lucide-react';

interface LinkPortfolioProps {
  totalClicks: number;
  activeLinks: number;
  totalPlacements: number;
  averageClicksPerLink: number;
}

export function LinkPortfolio({
  totalClicks,
  activeLinks,
  totalPlacements,
  averageClicksPerLink,
}: LinkPortfolioProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Link Portfolio</h2>
        <button className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors">
          <Calendar className="w-3.5 h-3.5" />
          All Time
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-white mb-1">{totalClicks.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Tracked Clicks</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-white mb-1">{activeLinks}</p>
          <p className="text-xs text-gray-400">Active Links</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-white mb-1">{totalPlacements}</p>
          <p className="text-xs text-gray-400">Total Placements</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-white mb-1">{averageClicksPerLink.toFixed(1)}</p>
          <p className="text-xs text-gray-400">Avg Clicks/Link</p>
        </div>
      </div>
    </div>
  );
}
