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
├── index.html        # Unique - upstream shell without Sentry's Plausible tag
├── wrangler.jsonc    # Unique - Fields worker config
├── wrangler.canary.jsonc  # Unique - Canary config
└── wrangler.test.jsonc  # Unique - test config for shared upstream tests
```

This means upstream changes to `mcp-cloudflare` automatically apply here.

The non-symlinked files must be reviewed on every upstream sync, because upstream
edits to `mcp-cloudflare/index.html` or `mcp-cloudflare/wrangler.jsonc` do **not**
propagate automatically.

### Known drift from upstream

- **`MCP_CACHE` KV binding is missing.** Upstream added a `MCP_CACHE` namespace
  used to cache org/project constraint verification. The code fails open (a
  warning is logged and verification falls back to a live API call), so the
  worker still functions, but every constrained `/mcp/<org>` request pays the
  extra round trip. Fix by creating the namespace and adding the binding to
  `wrangler.jsonc` and `wrangler.canary.jsonc`.
- **Single `MCP_RATE_LIMITER` binding.** Upstream split this into
  `MCP_IP_RATE_LIMITER` and `MCP_USER_RATE_LIMITER`. The server still honours the
  legacy binding for both checks, so no action is required.

## Setup

### 1. Create Cloudflare KV Namespaces

```bash
cd packages/mcp-cloudflare-fields

# Production
wrangler kv:namespace create OAUTH_KV
# Note the ID and update wrangler.jsonc

# Canary
wrangler kv:namespace create OAUTH_KV_CANARY
# Note the ID and update wrangler.canary.jsonc
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

All of the following are read as **secrets** by `.github/workflows/deploy-fields.yml`:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_SUBDOMAIN` - Your workers.dev subdomain
- `SENTRY_AUTH_TOKEN` - Auth token from s.fields.app (for source maps)
- `SENTRY_ORG` - Org slug on s.fields.app (for source maps)
- `SENTRY_PROJECT` - Project slug on s.fields.app (for source maps)
- `SENTRY_HOST_FIELDS` - `s.fields.app`, used to build `SENTRY_URL`

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

`.github/workflows/sync-upstream.yml` runs daily (and on `workflow_dispatch`) and
rebases the fork onto `upstream/main` so GitHub reports 0 commits behind. When the
rebase conflicts, it opens a PR with the conflicts resolved instead.

Manually:

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/getsentry/sentry-mcp.git

# Rebase (not merge - merging leaves the fork "behind" upstream)
git fetch upstream main
git rebase upstream/main
```

The symlinks ensure source code changes from upstream automatically apply. The
files listed as "Unique" above, plus the `*.yml.disabled` workflows, are the only
things a sync needs to reconcile by hand.
