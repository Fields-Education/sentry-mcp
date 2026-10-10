# Disabled upstream workflows

This is the Fields Education fork of
[getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp). The workflows in
this directory come from upstream and are **not** meant to run here: they deploy
to Sentry's Cloudflare account, publish Sentry's npm packages and releases, and
depend on secrets and runners that this fork does not have.

GitHub only schedules workflows found in `.github/workflows/`, so moving the
files one level up makes them completely inert while keeping them readable and
making future upstream rebases conflict-free.

> Why not a `.disabled` suffix? GitHub rejects pushes that create or update any
> file under `.github/workflows/` unless the pushing token carries the
> `workflows` permission. The `GITHUB_TOKEN` used by our sync automation does
> not have it, so renaming in place cannot be pushed. Deleting from
> `.github/workflows/` is allowed, which is what this move does.

## Active workflows on this fork

Only these two live in `.github/workflows/`:

| Workflow            | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `deploy-fields.yml` | Build and deploy `packages/mcp-cloudflare-fields` to Cloudflare |
| `sync-upstream.yml` | Rebase `main` onto `upstream/main` and open a sync PR           |

## Rules for syncing

After rebasing onto `upstream/main`, move **every** new or restored
`.github/workflows/*.yml` into this directory, except the two listed above.
Upstream adds workflows regularly (`cli-build.yml`, `mcp-registry.yml`,
`pr-risk-jev.yml`, `recover-cloudflare-deployment.yml`, ...), and anything left
behind will start running against this fork.

Scripts and docs that reference these files — `scripts/deploy-workflow.test.mjs`,
`scripts/migrate-cloudflare-token.test.mjs`, `scripts/ci-projects.test.mjs`, and
`docs/cli/README.md` — point at `.github/disabled-workflows/` on this fork.
