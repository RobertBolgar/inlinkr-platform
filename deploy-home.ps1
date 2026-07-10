# Deploy the InLinkr marketing site to Cloudflare Pages
# The marketing site is a separate project (inlinkr-home) from the main app.
# The main app continues to deploy with `wrangler.toml` / `wrangler deploy`.

$ErrorActionPreference = "Stop"

Write-Host "Deploying site/ to inlinkr-home Pages project..." -ForegroundColor Green

npx wrangler pages deploy --cwd site --branch main

Write-Host "Done." -ForegroundColor Green
