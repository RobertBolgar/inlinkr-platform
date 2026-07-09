import { TrendingUp } from 'lucide-react';

interface LinkActivityChartProps {
  data?: number[];
}

export function LinkActivityChart({ data = [12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45] }: LinkActivityChartProps) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-white">Smart Link Activity</h2>
      </div>

      <div className="relative h-32 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <polyline
            points={points}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="text-xs text-gray-500 mt-3 text-center">Portfolio growth over time</p>
    </div>
  );
}
