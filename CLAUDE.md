# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
shopify app dev          # Start local dev server (tunnels to Shopify)

# Build & Deploy
react-router build       # Production build
shopify app deploy       # Deploy to Shopify

# Database
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma migrate dev   # Create and apply a new migration (dev)
npx prisma migrate deploy # Apply migrations (production)
npx prisma studio        # Open Prisma Studio GUI

# Code Quality
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking (react-router typegen + tsc)
```

## Architecture Overview

This is a **Shopify embedded app** built with **React Router 7** (not Remix), **Prisma ORM** with **PostgreSQL**, and a **Shopify theme extension**.

### Core App Flow

1. Merchants install via Shopify OAuth (`/auth/*` routes, handled by `@shopify/shopify-app-react-router`)
2. After install, they connect their Instagram account via Instagram OAuth (`/instagram/callback/route.js`)
3. Instagram media is synced to the DB (`/api/instagram/sync.jsx` and cron at `/api/cron/instagram-sync.jsx`)
4. Merchants configure feed settings via the dashboard (`/app/_index.jsx`)
5. The storefront theme extension (`extensions/instagram-reels-display/`) fetches and displays media via the public API endpoint (`/api/reels/$shop.jsx`)

### Key Files

- `app/shopify.server.js` — Shopify app SDK initialization; exports the `shopify` auth helper
- `app/db.server.js` — Prisma client singleton
- `app/routes/app.jsx` — Shopify App Bridge provider + nav layout wrapper (all `/app/*` routes are authenticated)
- `app/routes/app._index.jsx` — Main dashboard: Instagram connect/disconnect, feed settings, media management
- `app/routes/instagram.callback/route.js` — Instagram OAuth callback; exchanges code for access token, stores connection
- `app/routes/api.reels.$shop.jsx` — **Public** API used by the theme extension to fetch media for a shop
- `prisma/schema.prisma` — Database models: `Session`, `InstagramConnection`, `InstagramMedia`, `FeedSettings`

### Data Models (Prisma / PostgreSQL)

- **Session** — Shopify session storage (managed by Shopify SDK)
- **InstagramConnection** — One per shop; holds Instagram OAuth token, account info
- **InstagramMedia** — Up to 25 posts per shop (images/videos; carousels excluded); has `displayOrder`
- **FeedSettings** — Feed display configuration per shop (layout, format, columns, spacing, etc.); 1-to-1 with `InstagramConnection`

### Theme Extension

Located in `extensions/instagram-reels-display/`. Two Liquid blocks:
- `instagram_reels.liquid` — Custom-rendered feed block
- `instagram_reels_embed.liquid` — Embed variant

Both fetch from `/api/reels/$shop` at runtime.

### Shopify App Config

- Config file: `shopify.app.instagram.toml`
- Scopes: `read_themes`
- Webhooks API version: `2026-01`
- GDPR webhooks: `webhooks.shop-redact`, `webhooks.customers-redact`, `webhooks.customers-data-request`

### MCP Integration

`.mcp.json` configures the `@shopify/dev-mcp` server, which provides Shopify API documentation and tooling assistance directly in Claude Code.

### Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` — Set by `shopify app dev` automatically
- Instagram OAuth credentials are currently hardcoded in `instagram.callback/route.js` and should be moved to env vars
