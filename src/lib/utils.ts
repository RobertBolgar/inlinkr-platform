import { getPlacementLabel } from './placement-intelligence';

/**
 * Format source code to human-readable label
 * Maps null/undefined/empty values to "Direct"
 * Uses centralized placement intelligence registry
 * Returns unknown source codes as-is
 */
export function formatSourceLabel(source: string | null | undefined): string {
  return getPlacementLabel(source);
}

/**
 * Decode the most common HTML entities found in scraped page titles.
 * Intentionally minimal (no full HTML parsing) since this runs on
 * short title strings extracted from <title>/og:title tags.
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m;
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m;
    });
}

const TITLE_MAX_LENGTH = 60;

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function commaCount(value: string): number {
  return (value.match(/,/g) || []).length;
}

function truncateAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  // Prefer a clean word boundary if it doesn't trim away too much
  if (lastSpace > max * 0.6) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

/**
 * Clean up an auto-generated Smart Link title derived from a scraped
 * page <title>/og:title value.
 *
 * Behavior:
 * - Decodes common HTML entities (e.g. `&amp;` -> `&`).
 * - Trims and collapses repeated whitespace.
 * - Splits on common separators (`|`, em/en dash, ` - `, `::`, `»`).
 * - Drops obvious site-name brand prefixes when a cleaner descriptive
 *   segment exists, otherwise keeps the brand.
 * - Avoids returning extremely short results unless no better option exists.
 * - Limits the final title to ~60 characters at a word boundary.
 *
 * NOTE: This is only intended for auto-filled titles. Manually typed
 * titles should never be passed through this helper.
 */
export function cleanAutoTitle(raw: string | null | undefined): string {
  if (!raw) return '';

  // Decode entities, normalize whitespace.
  const normalized = decodeHtmlEntities(String(raw))
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  // Split on common title separators.
  // Hyphen only counts as a separator when surrounded by whitespace so
  // hyphenated words (e.g. "Spider-Man") are preserved.
  const parts = normalized
    .split(/\s*\|\s*|\s*»\s*|\s*::\s*|\s*\u2014\s*|\s*\u2013\s*|\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  let candidate = normalized;

  if (parts.length > 1) {
    const first = parts[0];
    candidate = first;

    // If the first segment looks like a short brand/site name, prefer a
    // later segment that reads as a clean descriptive phrase.
    if (wordCount(first) <= 2) {
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (wordCount(part) >= 2 && commaCount(part) <= 1) {
          candidate = part;
          break;
        }
      }
    }
  }

  candidate = candidate.trim();
  if (!candidate) candidate = normalized;

  return truncateAtWord(candidate, TITLE_MAX_LENGTH);
}
