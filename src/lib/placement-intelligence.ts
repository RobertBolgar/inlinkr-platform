/**
 * Centralized Placement Intelligence Registry
 * Single source of truth for placement labels, badges, clickability, friction, and creator guidance.
 */

// Type definitions
export type PlacementKind =
  | 'description'
  | 'pinned'
  | 'bio'
  | 'short'
  | 'video'
  | 'qr_code'
  | 'other'
  | 'direct';

export type PlacementClickability =
  | 'clickable'
  | 'manual'
  | 'mobile_limited'
  | 'unknown';

export type PlacementFriction =
  | 'low'
  | 'medium'
  | 'high'
  | 'variable';

export type PlacementMetadata = {
  type: PlacementKind;
  label: string;
  shortLabel: string;
  defaultSourceCode?: string;
  badgeLabel: string;
  badgeTone: 'blue' | 'green' | 'amber' | 'purple' | 'cyan' | 'gray';
  clickability: PlacementClickability;
  friction: PlacementFriction;
  clickable: boolean;
  mobileLimited: boolean;
  description: string;
  creatorGuidance: string;
  bestUseCases: string[];
};

// Placement metadata registry
const PLACEMENT_METADATA: Record<PlacementKind, PlacementMetadata> = {
  description: {
    type: 'description',
    label: 'YouTube Description',
    shortLabel: 'Description',
    defaultSourceCode: 'd',
    badgeLabel: 'Clickable',
    badgeTone: 'blue',
    clickability: 'clickable',
    friction: 'low',
    clickable: true,
    mobileLimited: false,
    description: 'Links here open directly for viewers.',
    creatorGuidance: 'Best for offers, affiliate links, booking pages, and resources viewers may want after watching.',
    bestUseCases: ['affiliate links', 'booking pages', 'sponsorship links', 'resources'],
  },
  pinned: {
    type: 'pinned',
    label: 'Pinned Comment',
    shortLabel: 'Pinned',
    defaultSourceCode: 'p',
    badgeLabel: 'Clickable',
    badgeTone: 'green',
    clickability: 'clickable',
    friction: 'medium',
    clickable: true,
    mobileLimited: false,
    description: 'Pinned comments can drive focused clicks from viewers who read comments.',
    creatorGuidance: 'Best for repeated CTAs, launch links, sponsor mentions, and links you want viewers to notice after watching.',
    bestUseCases: ['sponsor CTAs', 'launch links', 'follow-up resources', 'repeated calls to action'],
  },
  bio: {
    type: 'bio',
    label: 'Channel Bio',
    shortLabel: 'Bio',
    defaultSourceCode: 'b',
    badgeLabel: 'Clickable',
    badgeTone: 'purple',
    clickability: 'clickable',
    friction: 'medium',
    clickable: true,
    mobileLimited: false,
    description: 'Bio links help capture viewers who visit your channel profile.',
    creatorGuidance: 'Best for evergreen offers, creator hubs, newsletters, and main destination links.',
    bestUseCases: ['creator hubs', 'newsletters', 'evergreen offers', 'main links'],
  },
  short: {
    type: 'short',
    label: 'Shorts Description',
    shortLabel: 'Shorts',
    defaultSourceCode: 's',
    badgeLabel: 'Mobile Limited',
    badgeTone: 'amber',
    clickability: 'mobile_limited',
    friction: 'variable',
    clickable: false,
    mobileLimited: true,
    description: 'Links placed around Shorts can be harder to track consistently, especially when viewers move between mobile surfaces.',
    creatorGuidance: 'Use memorable short links and compare results carefully. Tracked clicks may represent a minimum floor when viewers manually type or follow from related surfaces.',
    bestUseCases: ['short memorable URLs', 'related video funnels', 'verbal CTAs', 'mobile traffic tests'],
  },
  video: {
    type: 'video',
    label: 'Spoken CTA',
    shortLabel: 'Spoken',
    defaultSourceCode: 'v',
    badgeLabel: 'Manual / Visible',
    badgeTone: 'cyan',
    clickability: 'manual',
    friction: 'high',
    clickable: false,
    mobileLimited: false,
    description: 'Spoken, visible, overlay, or sponsor mention behavior where viewers may need to manually type or remember the link.',
    creatorGuidance: 'Best when the URL is short, memorable, and repeated visually or verbally.',
    bestUseCases: ['spoken CTAs', 'visible overlays', 'memorable short links', 'sponsor mentions'],
  },
  qr_code: {
    type: 'qr_code',
    label: 'Video QR Code',
    shortLabel: 'QR',
    defaultSourceCode: 'q',
    badgeLabel: 'Scannable',
    badgeTone: 'purple',
    clickability: 'clickable',
    friction: 'low',
    clickable: true,
    mobileLimited: false,
    description: 'QR codes provide instant, frictionless access to your link when scanned.',
    creatorGuidance: 'Best for in-video placements, print materials, and physical locations where viewers can scan with their phone.',
    bestUseCases: ['in-video QR codes', 'flyers', 'posters', 'business cards', 'event booths', 'product packaging'],
  },
  other: {
    type: 'other',
    label: 'Custom Placement',
    shortLabel: 'Custom',
    defaultSourceCode: undefined,
    badgeLabel: 'Custom',
    badgeTone: 'gray',
    clickability: 'unknown',
    friction: 'variable',
    clickable: false,
    mobileLimited: false,
    description: 'Custom placements help track traffic from any source you want to compare.',
    creatorGuidance: 'Use this when you want to test a placement that does not fit a standard YouTube surface.',
    bestUseCases: ['experiments', 'social posts', 'newsletters', 'custom campaigns'],
  },
  direct: {
    type: 'direct',
    label: 'Direct',
    shortLabel: 'Direct',
    defaultSourceCode: undefined,
    badgeLabel: 'Tracked Clicks',
    badgeTone: 'gray',
    clickability: 'unknown',
    friction: 'variable',
    clickable: false,
    mobileLimited: false,
    description: 'Direct traffic includes visits where no placement source was detected.',
    creatorGuidance: 'Use direct traffic as a signal for manually typed URLs, copied links, private sharing, or unattributed traffic.',
    bestUseCases: ['copied links', 'private sharing', 'typed URLs', 'unattributed traffic'],
  },
};

// Helper functions

/**
 * Normalize input to a PlacementKind.
 * Handles types, source codes, public codes, and label-ish strings.
 */
function normalizePlacementKind(input?: string | null): PlacementKind {
  if (!input || input.trim() === '') {
    return 'direct';
  }

  const normalized = input.toLowerCase().trim();

  // Direct type match
  if (PLACEMENT_METADATA[normalized as PlacementKind]) {
    return normalized as PlacementKind;
  }

  // Source code mapping
  const sourceCodeMap: Record<string, PlacementKind> = {
    'd': 'description',
    'p': 'pinned',
    'b': 'bio',
    's': 'short',
    'v': 'video',
  };

  if (sourceCodeMap[normalized]) {
    return sourceCodeMap[normalized];
  }

  // Custom codes (c1, c2, etc.) map to other
  if (/^c\d+$/.test(normalized)) {
    return 'other';
  }

  // Label-ish string matching with aliases
  // YouTube Description aliases
  if (normalized.includes('description')) {
    return 'description';
  }
  if (normalized.includes('video description') || normalized === 'video description') {
    return 'description';
  }
  if (normalized.includes('description link')) {
    return 'description';
  }
  if (normalized.includes('longform description')) {
    return 'description';
  }

  // Pinned Comment aliases
  if (normalized.includes('pinned')) {
    return 'pinned';
  }
  if (normalized === 'comment' || normalized.includes('regular comment')) {
    return 'pinned';
  }
  if (normalized.includes('video comment')) {
    return 'pinned';
  }

  // Channel Bio aliases
  if (normalized.includes('bio')) {
    return 'bio';
  }
  if (normalized.includes('about page')) {
    return 'bio';
  }
  if (normalized.includes('channel description')) {
    return 'bio';
  }
  if (normalized.includes('channel profile')) {
    return 'bio';
  }
  if (normalized.includes('profile link')) {
    return 'bio';
  }
  if (normalized.includes('official links')) {
    return 'bio';
  }
  if (normalized.includes('links section')) {
    return 'bio';
  }

  // Shorts Description aliases
  if (normalized.includes('short')) {
    return 'short';
  }
  if (normalized === 'shorts' || normalized.includes('shorts traffic')) {
    return 'short';
  }
  if (normalized.includes('shorts description')) {
    return 'short';
  }
  if (normalized.includes('shorts comment')) {
    return 'short';
  }
  if (normalized.includes('pinned short')) {
    return 'short';
  }
  if (normalized.includes('short pinned comment')) {
    return 'short';
  }

  // Video Mention aliases
  if (normalized.includes('video')) {
    return 'video';
  }
  if (normalized.includes('spoken cta') || normalized.includes('verbal cta')) {
    return 'video';
  }
  if (normalized.includes('voiceover')) {
    return 'video';
  }
  if (normalized.includes('sponsor mention') || normalized.includes('sponsorship mention')) {
    return 'video';
  }
  if (normalized.includes('in-video mention')) {
    return 'video';
  }
  if (normalized.includes('overlay')) {
    return 'video';
  }
  if (normalized.includes('on screen') || normalized.includes('onscreen')) {
    return 'video';
  }

  // Custom Placement aliases
  if (normalized.includes('community post')) {
    return 'other';
  }
  if (normalized.includes('end screen')) {
    return 'other';
  }
  if (normalized.includes('info card') || normalized === 'card') {
    return 'other';
  }
  if (normalized.includes('live chat')) {
    return 'other';
  }
  if (normalized.includes('playlist description')) {
    return 'other';
  }
  if (normalized.includes('membership post')) {
    return 'other';
  }

  // Direct
  if (normalized.includes('direct')) {
    return 'direct';
  }

  // Fallback to other for unknown inputs
  return 'other';
}

/**
 * Get placement metadata for a given input.
 * Accepts placement type, source code, public code, or label-ish string.
 * Falls back to 'other' if unknown.
 * Treats null/undefined/empty as 'direct'.
 */
export function getPlacementMetadata(input?: string | null): PlacementMetadata {
  const kind = normalizePlacementKind(input);
  return PLACEMENT_METADATA[kind];
}

/**
 * Get the full label for a placement.
 */
export function getPlacementLabel(input?: string | null): string {
  return getPlacementMetadata(input).label;
}

/**
 * Get the short label for a placement.
 */
export function getPlacementShortLabel(input?: string | null): string {
  return getPlacementMetadata(input).shortLabel;
}

/**
 * Get the badge label for a placement.
 */
export function getPlacementBadgeLabel(input?: string | null): string {
  return getPlacementMetadata(input).badgeLabel;
}

/**
 * Get the default source code for a placement type.
 */
export function getPlacementDefaultSourceCode(type: PlacementKind): string | undefined {
  return PLACEMENT_METADATA[type].defaultSourceCode;
}

/**
 * Check if a placement is clickable.
 */
export function isPlacementClickable(input?: string | null): boolean {
  return getPlacementMetadata(input).clickable;
}

/**
 * Check if a placement is mobile limited.
 */
export function isPlacementMobileLimited(input?: string | null): boolean {
  return getPlacementMetadata(input).mobileLimited;
}

/**
 * Get the friction level for a placement.
 */
export function getPlacementFriction(input?: string | null): PlacementFriction {
  return getPlacementMetadata(input).friction;
}

/**
 * Get all placement metadata entries.
 */
export function getAllPlacementMetadata(): PlacementMetadata[] {
  return Object.values(PLACEMENT_METADATA);
}

/**
 * Get all placement kinds.
 */
export function getAllPlacementKinds(): PlacementKind[] {
  return Object.keys(PLACEMENT_METADATA) as PlacementKind[];
}

/**
 * Get sponsor-facing placement label for proof cards.
 * Normalizes internal placement labels into creator/sponsor-friendly language.
 * This is specifically for public proof cards and sponsor-facing assets.
 * Does NOT change internal/dashboard analytics labels.
 */
export function getSponsorPlacementLabel(input?: string | null): string {
  const kind = normalizePlacementKind(input);
  
  // Sponsor-facing label mapping
  const sponsorLabels: Record<PlacementKind, string> = {
    description: 'Video Description',
    pinned: 'Pinned Comment',
    bio: 'Channel Bio',
    short: 'Shorts CTA',
    video: 'Video CTA',
    qr_code: 'QR Code',
    other: 'Creator Placement',
    direct: 'Direct Share',
  };
  
  return sponsorLabels[kind];
}
