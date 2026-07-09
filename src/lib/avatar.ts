import { User } from './cloudflare';

/**
 * Get the display avatar URL for a user.
 *
 * Fallback hierarchy:
 * 1. YouTube avatar for any user with connected YouTube channel
 * 2. Clerk avatar (from Clerk auth)
 * 3. null (Avatar component will show initials)
 *
 * @param user - The TubeLinkr user object from AuthContext
 * @param clerkImageUrl - The Clerk user's imageUrl from Clerk auth
 * @returns The avatar URL to display, or null if none available
 */
export function getDisplayAvatar(user: User | null, clerkImageUrl: string | null | undefined): string | null {
  // Use YouTube avatar for any user with connected YouTube channel
  if (user?.youtube_avatar_url) {
    return user.youtube_avatar_url;
  }

  // Fallback to Clerk avatar
  return clerkImageUrl || null;
}
