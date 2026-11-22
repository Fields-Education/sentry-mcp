# Fields MCP Cloudflare Worker

Fork of `@sentry/mcp-cloudflare` configured for deployment to Fields infrastructure, pointing to self-hosted Sentry at `s.fields.app`.

## Architecture

This directory holds only Fields-specific config. There is no separate workspace package: CI copies these wrangler files over `packages/mcp-cloudflare/` and builds/deploys upstream's package with them.

```
mcp-cloudflare-fields/
├── wrangler.jsonc         # Fields production worker (sentry-mcp-fields)
├── wrangler.canary.jsonc  # Fields canary worker (sentry-mcp-fields-canary)
├── check-bindings.mjs     # Fails if upstream adds a binding these configs lack
└── .env.example           # Local dev vars
```

Because the fork never modifies upstream files, upstream merges apply cleanly and `pnpm-lock.yaml` stays identical to upstream.

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

Secrets used by the Fields workflows:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` - deploys (org-level)
- `CLOUDFLARE_SUBDOMAIN` - workers.dev subdomain, used by smoke tests
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_HOST_FIELDS` - source map upload to s.fields.app

## Local Development

```bash
cp packages/mcp-cloudflare-fields/wrangler*.jsonc packages/mcp-cloudflare/
cp packages/mcp-cloudflare-fields/.env.example packages/mcp-cloudflare/.dev.vars  # then fill in values
pnpm --filter @sentry/mcp-cloudflare dev
git checkout -- packages/mcp-cloudflare  # restore upstream configs when done
```

## Deployment

`.github/workflows/deploy-fields.yml` runs on every push to `main`: canary deploy → smoke tests → production deploy → smoke tests (rolls back on failure).

New KV bindings without an `id` (currently `MCP_CACHE`) are created automatically by `wrangler deploy` and stay linked to the worker.

## Syncing with Upstream

`.github/workflows/sync-upstream.yml` runs daily with the built-in `GITHUB_TOKEN` (no PAT or app). It merges `upstream/main`, resets `.github/workflows` to just our two workflows (upstream's never land here), verifies the Fields build, pushes `main`, and dispatches the deploy.

`GITHUB_TOKEN` may push upstream commits that touch workflows only if the pushed tip leaves `.github/workflows` unchanged, so edits to `deploy-fields.yml` or `sync-upstream.yml` must go through a normal PR.

If a run fails, resolve it locally:

```bash
git fetch upstream
git merge upstream/main
git rm -rq --cached .github/workflows && rm -rf .github/workflows && git checkout HEAD -- .github/workflows
node packages/mcp-cloudflare-fields/check-bindings.mjs  # add any missing bindings to our wrangler configs
```

Keep upstream files unmodified. Fork changes belong in this directory or the two Fields workflows.
