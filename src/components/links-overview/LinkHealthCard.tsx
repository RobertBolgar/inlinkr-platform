import { CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

interface LinkHealthCardProps {
  activeLinks: number;
  linksWithPlacements: number;
  linksWithoutPlacements: number;
}

export function LinkHealthCard({
  activeLinks,
  linksWithPlacements,
  linksWithoutPlacements,
}: LinkHealthCardProps) {
  const hasIssues = linksWithoutPlacements > 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {hasIssues ? (
          <AlertCircle className="w-4 h-4 text-yellow-400" />
        ) : (
          <CheckCircle className="w-4 h-4 text-green-400" />
        )}
        <h2 className="text-sm font-semibold text-white">Link Health</h2>
      </div>

      {hasIssues ? (
        <>
          <p className="text-xs text-gray-400">
            {activeLinks} Active Links
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {linksWithPlacements} with placements
          </p>
          <p className="text-xs text-yellow-400 mt-1">
            {linksWithoutPlacements} need placements
          </p>
          <RouterLink
            to="/links"
            className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-gray-800 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add placements
          </RouterLink>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            Everything looks healthy
          </p>
          <p className="text-xs text-gray-500 mt-1">
            All active links have placements
          </p>
        </>
      )}
    </div>
  );
}
