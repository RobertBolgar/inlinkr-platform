import { getSponsorPlacementLabel } from './placement-intelligence';

/**
 * Generate sponsor-friendly share text for proof cards
 * Uses sponsor-facing placement labels and concise formatting
 */
export function generateShareText(proof: {
  title: string | null;
  clicks: number;
  converting_placements?: Array<{ source_code: string; click_count: number }> | null;
  proofUrl?: string;
}): string {
  const { clicks, converting_placements, proofUrl } = proof;

  let text = `This video sent ${clicks} directly measured clicks to the tracked destination.`;

  // Add converting placements if available
  if (converting_placements && converting_placements.length > 0) {
    text += '\n\n';
    converting_placements.forEach((placement) => {
      const label = getSponsorPlacementLabel(placement.source_code);
      text += `${label} · ${placement.click_count} clicks\n`;
    });
  }

  // Add proof URL if provided
  if (proofUrl) {
    text += `\nTracked Clicks Proof:\n${proofUrl}`;
  }

  return text;
}

/**
 * Generate share URL for X/Twitter
 */
export function generateTwitterShareUrl(text: string, url: string): string {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
}
