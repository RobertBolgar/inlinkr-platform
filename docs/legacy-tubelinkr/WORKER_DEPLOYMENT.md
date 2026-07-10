> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Cloudflare Worker Deployment Guide

This document explains how to deploy the public branded link Worker for go.tubelinkr.com.

## Overview

The Worker (`worker.js`) handles public redirect URLs in the format:
- `go.tubelinkr.com/{username}/{slug}`
- `go.tubelinkr.com/{username}/{slug}?source={code}`

The Worker:
1. Parses username and slug from the URL
2. Looks up user by username to get userId
3. Looks up link by userId and slug
4. Records click event directly to D1
5. Redirects to destination URL
6. Preserves all existing analytics and tracking logic

**NOTE:** The Worker now handles redirects directly. The legacy `/api/redirect` endpoint has been retired (410 Gone).

## Request Flow

```
Public URL → Worker → Direct Redirect → Destination
go.tubelinkr.com/robert/budget-mouse?source=d
    ↓
Worker looks up "robert" → userId
    ↓
Worker looks up link by userId and slug
    ↓
Worker records click event to D1
    ↓
302 redirect to destination URL
```

## Deployment Steps

### 1. Create Cloudflare Worker

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click "Create Application" → "Create Worker"
3. Name it: `tubelinkr-public` (or any name you prefer)
4. Copy the contents of `worker.js` into the Worker editor
5. Click "Deploy"

### 2. Configure Custom Domain

1. In the Worker dashboard, go to "Triggers" → "Custom Domains"
2. Click "Add Custom Domain"
3. Enter: `go.tubelinkr.com`
4. Cloudflare will provide DNS records to add:
   - A record: `go.tubelinkr.com` → Worker domain
5. Add these records to your DNS provider (Cloudflare DNS if using Cloudflare)

### 3. Environment Variables (Optional)

The Worker doesn't require any environment variables. It uses the same database and API endpoints as the main application.

### 4. Local Development (Optional)

For local testing with Wrangler:

1. Install Wrangler: `npm install -g wrangler`
2. Login: `wrangler login`
3. Create wrangler.toml:
```toml
name = "tubelinkr-public"
main = "worker.js"
compatibility_date = "2024-01-01"

[[routes]]
pattern = "go.tubelinkr.com/*"
zone_name = "tubelinkr.com"
```

4. Test locally: `wrangler dev`

## Files Added/Modified

### Added:
- `worker.js` - Cloudflare Worker for public branded link routing
- `WORKER_DEPLOYMENT.md` - This deployment guide

### Modified:
- `src/pages/NewLinkPage.tsx` - Updated to show "Public Link (Live)" instead of "Coming Soon"
- `src/pages/LinksPage.tsx` - Updated variant buttons to use public link format

## Safety & Edge Cases

The Worker handles:
- ✅ Missing username → 404
- ✅ Missing slug → 404
- ✅ Invalid source values → Falls back to null
- ✅ Unknown username → 404
- ✅ Unknown slug → 404 (via existing redirect endpoint)

## Compatibility

- ⚠️ Legacy `/api/redirect/{userId}/{slug}?source={code}` endpoint retired (410 Gone)
- ✅ All analytics and source tracking preserved via Worker
- ✅ Current dashboard and link system remain compatible
- ✅ No database schema changes required
- ✅ Dedicated API route files handle all API endpoints

## Testing

After deployment, test:

1. Public link without source:
   ```
   https://go.tubelinkr.com/{username}/{slug}
   ```

2. Public link with source:
   ```
   https://go.tubelinkr.com/{username}/{slug}?source=d
   ```

3. Verify click tracking in dashboard shows correct source attribution

## Rollback

If issues occur, simply:
1. Disable the Worker in Cloudflare Dashboard
2. Remove the custom domain mapping
3. Frontend will fall back to internal tracking links
4. No data loss or breaking changes
