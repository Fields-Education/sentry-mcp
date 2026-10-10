# Fields MCP Cloudflare Worker

Fork of `@sentry/mcp-cloudflare` configured for deployment to Fields infrastructure, pointing to self-hosted Sentry at `s.fields.app`.

## Architecture

This package uses symlinks to the original `mcp-cloudflare` package for all source code, with only configuration files being unique:

```
mcp-cloudflare-fields/
├── src/              → symlink to ../mcp-cloudflare/src/
├── public/           → symlink to ../mcp-cloudflare/public/
├── vite.config.ts    → symlink to ../mcp-cloudflare/vite.config.ts
├── tsconfig*.json    → symlinks to ../mcp-cloudflare/
├── package.json      # Unique - different name
├── wrangler.jsonc    # Unique - Fields worker config
├── wrangler.canary.jsonc  # Unique - Canary config
└── wrangler.test.jsonc  # Unique - test config for shared upstream tests
```

This means upstream changes to `mcp-cloudflare` automatically apply here.

## Setup

### 1. Create Cloudflare KV Namespaces

```bash
cd packages/mcp-cloudflare-fields

# Production
wrangler kv namespace create OAUTH_KV
# Note the ID and update wrangler.jsonc

# Canary
wrangler kv namespace create OAUTH_KV_CANARY
# Note the ID and update wrangler.canary.jsonc
```

Upstream also binds `MCP_CACHE`, a KV namespace used to cache per-user
organization/project access verification. It is currently commented out in both
wrangler configs, so constraint verification fails open and re-checks Sentry on
every MCP request. To enable it:

```bash
wrangler kv namespace create MCP_CACHE
# Uncomment the MCP_CACHE binding in wrangler.jsonc with the returned ID
```

### 2. Create OAuth App on s.fields.app

1. Go to https://s.fields.app/settings/account/api/applications/
2. Create new OAuth application:
   - **Homepage URL**: `https://sentry-mcp-fields.YOUR_SUBDOMAIN.workers.dev`
   - **Redirect URI**: `https://sentry-mcp-fields.YOUR_SUBDOMAIN.workers.dev/oauth/callback`
3. Note the Client ID and Secret

### 3. Create Sentry Project for Error Reporting

1. Create a project on s.fields.app
2. Note the DSN

### 4. Set Cloudflare Secrets

```bash
cd packages/mcp-cloudflare-fields

# Production secrets
wrangler secret put SENTRY_CLIENT_ID
wrangler secret put SENTRY_CLIENT_SECRET
wrangler secret put COOKIE_SECRET
wrangler secret put OPENROUTER_API_KEY
wrangler secret put SENTRY_DSN
wrangler secret put SENTRY_HOST  # Enter: s.fields.app

# Canary secrets (same values)
wrangler secret put SENTRY_CLIENT_ID --config wrangler.canary.jsonc
wrangler secret put SENTRY_CLIENT_SECRET --config wrangler.canary.jsonc
wrangler secret put COOKIE_SECRET --config wrangler.canary.jsonc
wrangler secret put OPENROUTER_API_KEY --config wrangler.canary.jsonc
wrangler secret put SENTRY_DSN --config wrangler.canary.jsonc
wrangler secret put SENTRY_HOST --config wrangler.canary.jsonc
```

### 5. Configure GitHub Repository

Add these secrets/variables to your fork:

`.github/workflows/deploy-fields.yml` reads all of these from repository
**secrets**:

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers deploy scope
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `CLOUDFLARE_SUBDOMAIN` - Your `workers.dev` subdomain (used by smoke tests)
- `SENTRY_AUTH_TOKEN` - Auth token from s.fields.app (for source map upload)
- `SENTRY_ORG` - Org slug on s.fields.app (for source maps)
- `SENTRY_PROJECT` - Project slug on s.fields.app (for source maps)
- `SENTRY_HOST_FIELDS` - Sentry hostname, e.g. `s.fields.app` (for source maps)

## Local Development

```bash
# Copy env example to .dev.vars
cp .env.example .dev.vars

# Edit .dev.vars with your values
# Then start dev server
pnpm dev
```

Server runs on http://localhost:8790

## Deployment

Automatic via GitHub Actions when pushing to `main` (after tests pass).

Manual deployment:
```bash
# Canary
pnpm deploy:canary

# Production
pnpm deploy
```

## Syncing with Upstream

`.github/workflows/sync-upstream.yml` rebases `main` onto `upstream/main` on a
schedule so that upstream commit SHAs stay in our history. Manual equivalent:

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/getsentry/sentry-mcp.git

git fetch upstream main
git rebase upstream/main
```

The symlinks ensure source code changes from upstream automatically apply. The
non-symlinked files in this package (`package.json`, `index.html`,
`.env.example`, `wrangler*.jsonc`) must be diffed against their
`packages/mcp-cloudflare/` counterparts after a sync so new bindings, build
markers, and dependency changes are carried forward.
