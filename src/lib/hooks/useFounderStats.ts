import { useState, useEffect } from 'react';

interface FounderStats {
  claimed: number;
  limit: number;
}

interface FounderStatsResult {
  remaining: number;
  isSoldOut: boolean;
  displayText: string;
  isLoading: boolean;
}

export function useFounderStats(): FounderStatsResult {
  const [claimed, setClaimed] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const limit = 50;

  useEffect(() => {
    const fetchFounderStats = async () => {
      try {
        const response = await fetch('/api/founder-stats');
        if (response.ok) {
          const data: FounderStats = await response.json();
          setClaimed(data.claimed);
        }
      } catch (error) {
        // Silent fail - use fallback values
      } finally {
        setIsLoading(false);
      }
    };

    fetchFounderStats();
  }, []);

  const remaining = claimed !== null ? Math.max(0, limit - claimed) : limit;
  const isSoldOut = claimed !== null && claimed >= limit;

  let displayText: string;
  if (isLoading) {
    displayText = 'Limited to 50 founders';
  } else if (remaining <= 0) {
    displayText = 'All 50 spots claimed';
  } else if (remaining === 1) {
    displayText = 'Last Founder spot available';
  } else {
    displayText = `${remaining} spots left`;
  }

  return {
    remaining,
    isSoldOut,
    displayText,
    isLoading,
  };
}
