> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# TubeLinkr - Cloudflare-Powered Link Management

A modern link shortening and analytics platform built entirely on Cloudflare's ecosystem.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Cloudflare Pages Functions (serverless)
- **Database**: Cloudflare D1 (SQLite) via Wrangler bindings
- **Deployment**: Cloudflare Pages with Functions
- **Redirect Worker**: Cloudflare Worker for go.tubelinkr.com routing
- **Authentication**: Clerk (JWT-based)
- **Billing**: Stripe (subscriptions)
- **Email**: Resend API
- **YouTube Integration**: Google OAuth 2.0

## Development Notes

For temporary development workflows, see [`DEVIN_FLOW.md`](DEVIN_FLOW.md).

## Features

- Clean, memorable short links for YouTube creators
- Real-time click tracking and analytics
- User authentication with JWT tokens
- Responsive dark-themed UI
- Fast global CDN delivery

## Setup

### 1. Prerequisites
- Node.js 18+
- Cloudflare account
- Cloudflare Wrangler CLI

### 2. Database Setup

Create a D1 database and run the schema:

```bash
# Create D1 database
wrangler d1 create tubelinkr-db

# Run schema migrations
wrangler d1 execute tubelinkr-db --file=./cloudflare-schema.sql
```

### 3. Environment Variables

See `.env.example` for the complete list of environment variables with placeholder values.

**Cloudflare Pages - Production:**
- `CLERK_JWKS_URL` - Clerk JWT verification endpoint
- `CLERK_SECRET_KEY` - Clerk secret key for backend operations
- `GOOGLE_OAUTH_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_OAUTH_REDIRECT_URI` - OAuth callback URL
- `STRIPE_SECRET_KEY` - Stripe secret key (live mode for production)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `PRO_PRICE_ID_MONTHLY` - Stripe price ID for Pro monthly
- `PRO_PRICE_ID_YEARLY` - Stripe price ID for Pro yearly
- `RESEND_API_KEY` - Resend email API key
- `ADMIN_TEST_KEY` - Admin API key for admin endpoints
- `RATE_LIMITER` - Rate limiter Durable Object binding

**Cloudflare Pages - Preview/Dev Only:**
- `ALLOW_ADMIN_SET_PRO` - Enable admin set-pro endpoint for testing (WARNING: Do NOT enable in production)

**Cloudflare Worker (go.tubelinkr.com routing):**
- `PAGES_ORIGIN` - Production Pages origin URL
- `API_ORIGIN` - Production API origin URL
- `RESEND_API_KEY` - Resend email API key

**Frontend (Client-Side - Vite):**
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key for authentication

**Future/Disabled:**
- `REFERRAL_WORKER_SECRET` - Future implementation for Worker-only shared secret (not currently used)

**Security Note:**
- Never expose Cloudflare API tokens, Stripe secret keys, or other sensitive credentials through `VITE_*` frontend variables
- All secrets must be configured in Cloudflare Pages/Workers dashboard, not in client-side code
- D1 database access is handled via Wrangler bindings, not API tokens

### 4. Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### 5. Deployment

```bash
# Deploy to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name=tubelinkergit

# Or deploy Workers API
npx wrangler deploy
```

## Database Schema

The application uses three main tables:

- **users**: User accounts and authentication
- **links**: Short URLs and their destinations
- **click_events**: Click tracking and analytics

See `cloudflare-schema.sql` for the complete schema.

## API Endpoints

The Cloudflare Workers API provides:

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/links` - Get user's links
- `POST /api/links` - Create new link
- `PUT /api/links/:id` - Update link
- `DELETE /api/links/:id` - Delete link
- `GET /:username/:slug` - Redirect to original URL

## Performance

- Global edge caching with Cloudflare CDN
- Server-side rendering with Workers
- Optimized bundle size (~227KB gzipped)
- Fast D1 database queries

## Security

- JWT-based authentication
- SQL injection protection with parameterized queries
- Rate limiting on API endpoints
- HTTPS-only deployment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
