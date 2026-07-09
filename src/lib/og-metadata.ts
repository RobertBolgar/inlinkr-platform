/**
 * Open Graph metadata utilities for proof pages
 * 
 * This module provides utilities for generating OG metadata for proof pages.
 * Dynamic OG image generation is not yet implemented - this structure prepares
 * for future implementation without conflicts.
 * 
 * TODO: Implement dynamic OG image generation using:
 * - Cloudflare Workers with HTML-to-image conversion
 * - or Vercel OG library (if migrating to Vercel)
 * - or Cloudflare Images with on-demand generation
 */

export interface ProofOGMetadata {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}

/**
 * Generate OG metadata for a proof page
 * 
 * @param proof - Proof data from the API
 * @param proofUrl - Public URL of the proof page
 * @returns OG metadata object
 */
export function generateProofOGMetadata(proof: {
  title: string | null;
  clicks: number;
  thumbnail: string | null;
  destination_domain: string | null;
  converting_placements?: Array<{ source_code: string; click_count: number }> | null;
}, proofUrl: string): ProofOGMetadata {
  const title = proof.title || 'YouTube Video Proof';
  const description = `TubeLinkr tracked ${proof.clicks} outbound clicks from this YouTube video.`;
  
  // TODO: Replace with dynamic OG image generation
  // Current fallback: use video thumbnail or default TubeLinkr social image
  const imageUrl = proof.thumbnail || 'https://tubelinkr.com/tubelinkr-social.jpg';
  
  return {
    title: `${title} — TubeLinkr Proof`,
    description,
    imageUrl,
    url: proofUrl,
  };
}

/**
 * Update document meta tags for OG sharing
 * 
 * This function dynamically updates the document's meta tags for optimal
 * social media sharing. Should be called in a useEffect when proof data loads.
 * 
 * @param metadata - OG metadata object
 */
export function updateDocumentMetaTags(metadata: ProofOGMetadata): void {
  // Update basic meta tags
  document.title = metadata.title;
  
  // Update OG tags
  updateMetaTag('og:title', metadata.title);
  updateMetaTag('og:description', metadata.description);
  updateMetaTag('og:image', metadata.imageUrl);
  updateMetaTag('og:url', metadata.url);
  
  // Update Twitter card tags
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:title', metadata.title);
  updateMetaTag('twitter:description', metadata.description);
  updateMetaTag('twitter:image', metadata.imageUrl);
}

/**
 * Helper function to update a single meta tag
 */
export function updateMetaTag(property: string, content: string): void {
  // Try to find existing tag
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
  
  // If not found, try twitter:name variant
  if (!tag) {
    tag = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
  }
  
  if (tag) {
    tag.content = content;
  } else {
    // Create new tag if it doesn't exist
    const newTag = document.createElement('meta');
    if (property.startsWith('og:')) {
      newTag.setAttribute('property', property);
    } else {
      newTag.setAttribute('name', property);
    }
    newTag.content = content;
    document.head.appendChild(newTag);
  }
}

/**
 * Reset meta tags to default values
 * Call this when leaving a proof page to restore default site metadata
 */
export function resetDocumentMetaTags(): void {
  const defaultTitle = 'TubeLinkr — Track Which YouTube Videos Drive Clicks';
  const defaultDescription = 'See which YouTube descriptions, pinned comments, Shorts, and creator placements actually drive traffic and conversions.';
  const defaultImage = 'https://tubelinkr.com/tubelinkr-social.jpg';
  const defaultUrl = 'https://tubelinkr.com';
  
  document.title = defaultTitle;
  
  updateMetaTag('og:title', defaultTitle);
  updateMetaTag('og:description', defaultDescription);
  updateMetaTag('og:image', defaultImage);
  updateMetaTag('og:url', defaultUrl);
  
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:title', defaultTitle);
  updateMetaTag('twitter:description', defaultDescription);
  updateMetaTag('twitter:image', defaultImage);
}

/**
 * Update the canonical tag to point to the current route
 * 
 * @param path - The current route path (e.g., '/links', '/dashboard')
 */
export function updateCanonicalTag(path: string): void {
  const baseUrl = 'https://tubelinkr.com';
  const canonicalUrl = path === '/' ? baseUrl : `${baseUrl}${path}`;
  
  let canonicalTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  
  if (canonicalTag) {
    canonicalTag.href = canonicalUrl;
  } else {
    // Create canonical tag if it doesn't exist
    canonicalTag = document.createElement('link');
    canonicalTag.rel = 'canonical';
    canonicalTag.href = canonicalUrl;
    document.head.appendChild(canonicalTag);
  }
}
