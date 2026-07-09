import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface TopLink {
  id: string;
  name: string;
  clicks: number;
  percentage: number;
}

interface TopPerformingLinksProps {
  links: TopLink[];
}

export function TopPerformingLinks({ links }: TopPerformingLinksProps) {
  const getRankBadge = (rank: number) => {
    const colors = ['bg-yellow-500', 'bg-gray-400', 'bg-amber-600'];
    const labels = ['1st', '2nd', '3rd'];
    return (
      <div className={`w-6 h-6 rounded-full ${colors[rank - 1]} flex items-center justify-center text-[10px] font-bold text-white`} title={labels[rank - 1]}>
        {rank}
      </div>
    );
  };

  const formatPercentage = (value: number) => {
    if (value >= 100) return '100%';
    if (value >= 10) return `${Math.round(value)}%`;
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-4">Top Performing Links</h2>

      {links.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No links yet</p>
      ) : (
        <div className="space-y-3">
          {links.slice(0, 3).map((link, index) => (
            <div key={link.id} className="flex items-center gap-3">
              {getRankBadge(index + 1)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{link.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${link.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatPercentage(link.percentage)}</span>
                </div>
              </div>
              <span className="text-lg font-bold text-white whitespace-nowrap">{link.clicks}</span>
            </div>
          ))}
        </div>
      )}

      <Link
        to="/analytics"
        className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-gray-800 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        View all analytics
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
