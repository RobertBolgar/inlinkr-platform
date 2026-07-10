#!/usr/bin/env sh
# Deploy the InLinkr marketing site to Cloudflare Pages
# The marketing site is a separate project (inlinkr-home) from the main app.
# The main app continues to deploy with wrangler.toml / wrangler deploy.

set -e

echo "Deploying site/ to inlinkr-home Pages project..."

npx wrangler pages deploy --cwd site --branch main

echo "Done."
