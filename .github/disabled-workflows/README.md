# Disabled upstream workflows

Verbatim copies of `getsentry/sentry-mcp` workflows that must not run on this
fork. They live here instead of `.github/workflows/` for two reasons:

1. GitHub only schedules workflows found in `.github/workflows/`, so anything
   in this directory is inert.
2. `GITHUB_TOKEN` has no `workflows` permission, and GitHub rejects any push
   that creates or updates **any** file under `.github/workflows/` — including
   files renamed to `*.yml.disabled`. Deletions are allowed, so the upstream
   sync deletes them from `.github/workflows/` and stores them here.

Only `.github/workflows/deploy-fields.yml` and
`.github/workflows/sync-upstream.yml` are active, and neither may be modified
by the automated sync (any content change there is rejected by the same rule).

## Updating `.github/workflows/`

Changes to the two active workflows must be pushed by a human, or by a token
belonging to an app/PAT that holds the `workflows` permission.

## Upstream sync

`.github/workflows/sync-upstream.yml` still renames upstream workflows to
`<name>.yml.disabled` in place, which will be rejected on push. It needs to be
updated to `git mv` them into this directory instead. See the sync PR that
introduced this directory for details.
