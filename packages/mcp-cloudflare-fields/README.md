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

### Why `jiti` and `yaml` are pinned in `package.json`

`jiti` and `yaml` are optional peer dependencies of `vite`. With two workspace
importers that both depend on `vite` via `catalog:`, pnpm can resolve those peers
to different versions per importer, producing two distinct `vite` instances. The
symlinked `vite.config.ts` then fails to typecheck under `tsc -b` with
"Two different types with this name exist, but they are unrelated".

Pinning both to the versions the `mcp-cloudflare` importer resolves forces a
single shared `vite` instance. If `vite` is upgraded upstream, re-check these
pins: run `pnpm install --lockfile-only` and confirm the `packages/mcp-cloudflare`
and `packages/mcp-cloudflare-fields` importer blocks in `pnpm-lock.yaml` list
identical versions.

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

> **Pending:** upstream added a required `MCP_CACHE` KV binding (used to cache
> org/project constraint verification for `/mcp/:org/:project` URLs). The Fields
> configs do not declare it yet because the namespace has to be created in the
> Fields Cloudflare account. Until it exists, constraint verification fails open:
> requests still work but skip the cache and log a warning per request.
>
> ```bash
> wrangler kv:namespace create MCP_CACHE
> # add the returned ID to kv_namespaces in wrangler.jsonc
>
> wrangler kv:namespace create MCP_CACHE_CANARY
> # add the returned ID to kv_namespaces in wrangler.canary.jsonc
> ```

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

**Secrets** (already have):
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**Variables** (new):
- `CLOUDFLARE_SUBDOMAIN` - Your workers.dev subdomain
- `SENTRY_ORG_FIELDS` - Org slug on s.fields.app (for source maps)
- `SENTRY_PROJECT_FIELDS` - Project slug on s.fields.app (for source maps)

**Secrets** (new):
- `SENTRY_AUTH_TOKEN` - Auth token from s.fields.app (for source maps)

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

Syncing is automated by `.github/workflows/sync-upstream.yml`, which branches from
`upstream/main` and re-applies the fork-specific delta on top so the fork never
reports as "behind" on GitHub.

To do it by hand:

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/getsentry/sentry-mcp.git
git fetch upstream main

# Branch from upstream and re-apply the fork delta
git checkout -b sync-upstream-$(date +%Y%m%d) upstream/main
git checkout origin/main -- \
  packages/mcp-cloudflare-fields \
  .github/workflows/deploy-fields.yml \
  .github/workflows/sync-upstream.yml

# Re-disable the upstream Sentry workflows
for f in deploy release warden test smoke-tests token-cost eval merge-jobs mcp-server-package; do
  [ -f ".github/workflows/$f.yml" ] && git mv ".github/workflows/$f.yml" ".github/workflows/$f.yml.disabled"
done

pnpm install   # regenerates pnpm-lock.yaml with the fork importer
```

The symlinks ensure source code changes from upstream automatically apply. Things
to re-check after each sync:

- `version` in `package.json` matches `../mcp-cloudflare/package.json`
- dependencies match `../mcp-cloudflare/package.json`
- bindings in `wrangler.jsonc` / `wrangler.canary.jsonc` cover everything in
  `Env` (`../mcp-cloudflare/src/server/types.ts`)
