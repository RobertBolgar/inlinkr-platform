import { Lightbulb, ChevronRight, Plus, Eye } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

interface OpportunitiesCardProps {
  linksWithoutPlacements: number;
  linksWithZeroClicks: number;
  newestLinkName?: string;
  newestLinkHasPlacements: boolean;
}

export function OpportunitiesCard({
  linksWithoutPlacements,
  linksWithZeroClicks,
  newestLinkName,
  newestLinkHasPlacements,
}: OpportunitiesCardProps) {
  const getOpportunity = () => {
    // Priority 1: Links with no placements
    if (linksWithoutPlacements > 0) {
      return {
        icon: <Plus className="w-4 h-4 text-yellow-400" />,
        title: `${linksWithoutPlacements} Smart Link${linksWithoutPlacements > 1 ? 's' : ''} have no placements`,
        subtitle: 'Add placements to start tracking',
        action: 'Add placements',
        actionIcon: <Plus className="w-3.5 h-3.5" />,
        actionLink: '/links',
      };
    }

    // Priority 2: Links with zero clicks
    if (linksWithZeroClicks > 0) {
      return {
        icon: <Eye className="w-4 h-4 text-blue-400" />,
        title: `${linksWithZeroClicks} link${linksWithZeroClicks > 1 ? 's' : ''} have never received clicks`,
        subtitle: 'Review and optimize your placements',
        action: 'Review links',
        actionIcon: <ChevronRight className="w-3.5 h-3.5" />,
        actionLink: '/links',
      };
    }

    // Priority 3: Newest link needing setup
    if (newestLinkName && !newestLinkHasPlacements) {
      return {
        icon: <Plus className="w-4 h-4 text-yellow-400" />,
        title: `Your newest Smart Link has no placements yet`,
        subtitle: newestLinkName,
        action: 'Finish setup',
        actionIcon: <Plus className="w-3.5 h-3.5" />,
        actionLink: '/links',
      };
    }

    // No issues
    return {
      icon: <Lightbulb className="w-4 h-4 text-green-400" />,
      title: 'Everything looks organized',
      subtitle: 'Your Smart Links are ready to track',
      action: null,
      actionIcon: null,
      actionLink: null,
    };
  };

  const opportunity = getOpportunity();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {opportunity.icon}
        <h2 className="text-sm font-semibold text-white">Opportunities</h2>
      </div>

      <p className="text-xs text-gray-400">{opportunity.title}</p>
      {opportunity.subtitle && (
        <p className="text-xs text-gray-500 mt-1">{opportunity.subtitle}</p>
      )}

      {opportunity.action && opportunity.actionLink && (
        <RouterLink
          to={opportunity.actionLink}
          className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-gray-800 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {opportunity.actionIcon}
          {opportunity.action}
        </RouterLink>
      )}
    </div>
  );
}
