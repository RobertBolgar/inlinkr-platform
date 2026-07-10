> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Redirect Worker Setup

This document describes how to set up the dedicated Cloudflare Worker for handling clean public redirect URLs on `go.tubelinkr.com`.

## Overview

The redirect Worker handles:
- `/{username}/{slug}` (base link)
- `/{username}/{slug}/{public_code}` (placement link)

This keeps the main app on `tubelinkr.com` (Cloudflare Pages) and moves all public redirect handling to a dedicated Worker on `go.tubelinkr.com`.

## Current Configuration

**IMPORTANT:** The current production redirect Worker uses `wrangler-go.toml`, NOT `wrangler-redirect.toml`.

- **wrangler-go.toml** - Current production configuration for go.tubelinkr.com
- **wrangler-redirect.toml** - OBSOLETE staging configuration (DO NOT USE)

The obsolete `wrangler-redirect.toml` points to the staging D1 database and should not be deployed for production.

## Files Created

1. **worker.js** - The Worker code that handles clean URL redirects and subdomain routing
2. **wrangler-go.toml** - Current Wrangler configuration for the Worker (production)

## D1 Bindings

**⚠️ CRITICAL:** The production redirect Worker (go.tubelinkr.com) MUST use the production D1 database:
- Production database name: `tubelinkr-prod-db`
- Production database ID: `97ea0d89-0e4f-449a-8ad9-1e8c7c2b689c`
- Binding name: `DB`

The staging database (`tubelinkr-db`) is only for development/staging environments and should NOT be used for production.

Current `wrangler-go.toml` is correctly configured for production D1.

## Deployment Steps

### 1. Deploy the Worker

```bash
npx wrangler deploy --config wrangler-go.toml
```

This will deploy the Worker to Cloudflare with the name `tubelinkr-go`.

### 2. Add Custom Domain

In the Cloudflare Dashboard:

1. Go to **Workers & Pages**
2. Select **tubelinkr-go**
3. Go to **Settings** > **Triggers**
4. Click **Add Custom Domain**
5. Enter: `go.tubelinkr.com`
6. Click **Add Custom Domain**

### 3. Configure DNS

In the Cloudflare Dashboard for the `tubelinkr.com` zone:

1. Go to **DNS** > **Records**
2. Add a CNAME record:
   - Name: `go`
   - Type: `CNAME`
   - Target: `tubelinkr-go.YOUR_ACCOUNT.workers.dev`
   - Proxy status: Proxied (orange cloud)

Note: The target will be provided after deploying the Worker in step 1.

### 4. Verify DNS Propagation

After adding the DNS record, wait for DNS propagation (usually a few minutes). You can verify with:

```bash
dig go.tubelinkr.com
```

## Testing

Once deployed, test the Worker with:

1. Base link: `https://go.tubelinkr.com/{username}/{slug}`
2. Placement link: `https://go.tubelinkr.com/{username}/{slug}/{public_code}`

Example:
```
https://go.tubelinkr.com/tubelinkr/testamz/bio
```

## Worker Logs

To view Worker logs:

```bash
npx wrangler tail --config wrangler-go.toml
```

## Backward Compatibility

The Worker supports:
- Clean URLs with `public_code` (new format)
- Query parameter `?source=` (old format)
- Direct `source_code` in path (backward compatibility)

## Architecture

```
User visits: https://go.tubelinkr.com/tubelinkr/testamz/bio
    ↓
DNS resolves to: tubelinkr-go.workers.dev
    ↓
Worker handles request:
    1. Parse username, slug, public_code
    2. Lookup user_id from username
    3. Lookup link by user_id + slug
    4. Lookup placement by link_id + public_code
    5. Use placement.source_code for attribution
    6. Record click event
    7. Redirect to original_url
```

## Security Considerations

- The Worker is isolated from the main Pages app
- If the Worker fails, the main app remains unaffected
- The Worker uses the same D1 database as the main app
- All database queries are parameterized to prevent SQL injection
