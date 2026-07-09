import { Link } from 'lucide-react';

interface PlacementsCardProps {
  count: number;
}

export function PlacementsCard({ count }: PlacementsCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Link className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-white">Placements</h2>
      </div>
      <p className="text-3xl font-bold text-white">{count}</p>
      <p className="text-xs text-gray-400 mt-1">Total placements</p>
      <p className="text-xs text-gray-500">Across all links</p>
    </div>
  );
}
