/**
 * PageSkeleton - App-like loading state
 * Mimics card layouts with min-height to prevent footer jump
 */
export function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8 space-y-4 min-h-[60vh]">
      {/* Skeleton header */}
      <div className="h-8 bg-gray-800/50 rounded-lg w-1/3 animate-pulse transition-opacity duration-300" />
      
      {/* Skeleton cards */}
      <div className="space-y-3">
        {/* Card 1 */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-4 transition-opacity duration-300">
          <div className="h-4 bg-gray-800/50 rounded w-1/4 mb-3 animate-pulse" />
          <div className="h-6 bg-gray-800/50 rounded w-1/2 mb-2 animate-pulse" />
          <div className="h-3 bg-gray-800/50 rounded w-3/4 animate-pulse" />
        </div>
        
        {/* Card 2 */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-4 transition-opacity duration-300">
          <div className="h-4 bg-gray-800/50 rounded w-1/4 mb-3 animate-pulse" />
          <div className="h-6 bg-gray-800/50 rounded w-2/3 mb-2 animate-pulse" />
          <div className="h-3 bg-gray-800/50 rounded w-1/2 animate-pulse" />
        </div>
        
        {/* Card 3 */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-4 transition-opacity duration-300">
          <div className="h-4 bg-gray-800/50 rounded w-1/4 mb-3 animate-pulse" />
          <div className="h-6 bg-gray-800/50 rounded w-1/3 mb-2 animate-pulse" />
          <div className="h-3 bg-gray-800/50 rounded w-2/3 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
