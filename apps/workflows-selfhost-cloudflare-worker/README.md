# apps/workflows-selfhost-cloudflare-worker

Reference single-tenant Cloudflare Worker for self-hosting Voyant
Workflows on a regular Cloudflare account.

This target is the self-host counterpart to
[`apps/workflows-orchestrator-worker`](../workflows-orchestrator-worker): it keeps the same
`/api/runs/*` HTTP surface and Durable-Object-backed orchestration, but
it does **not** require Workers for Platforms or a dispatch namespace.
The workflow bundle is imported directly into the same Worker.

## What you get

- One Worker that hosts both the public orchestration API and the
  tenant-side step execution.
- One Durable Object per run for run state + wakeups.
- Optional Cloudflare Container support for `runtime: "node"` steps.
- No dispatch namespace or cross-Worker tenant routing.

## Deploy flow

```bash
# 1. Build + stage the workflow bundle for the self-host Worker.
voyant workflows deploy --target cloudflare --file ./src/workflows.ts

# 1.5 Validate the staged worker + wrangler config.
voyant workflows doctor --target cloudflare
voyant workflows doctor --target cloudflare --check-cloudflare

# 2. If you use runtime: "node" steps, stage container.mjs in R2 and
#    register its SHA-256 in KV (same shape as the WfP tenant worker).

# 3. Deploy.
voyant workflows deploy --target cloudflare --file ./src/workflows.ts --apply
```

`--apply` wraps `pnpm --filter @voyant-travel/workflows-selfhost-cloudflare-worker deploy`.
Without it, the CLI only builds and stages `src/bundle.mjs`.

`doctor --target cloudflare` now also checks for the account-specific
placeholders that still ship in
[`wrangler.jsonc`](./wrangler.jsonc): the KV namespace id for
`BUNDLE_HASHES` and the `R2_ACCOUNT_ID` value. Until those are
replaced, the self-host worker is staged but not actually deployable.

## Public API auth

Set `VOYANT_API_TOKENS` (comma-separated bearer tokens) if you want the
public `/api/runs/*` surface protected. Leaving it unset is acceptable
for local experimentation, not for production.

## Container support

`runtime: "node"` steps use the same Cloudflare Container flow as the
hosted adapter:

- `NODE_STEP_POOL` Durable Object namespace
- `BUNDLE_R2` bucket holding `container.mjs`
- `BUNDLE_HASHES` KV namespace with deploy-time SHA-256 values
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` secrets for presigning
- `VOYANT_WORKFLOW_STEP_AUTH_SECRET`, shared with the Node step
  container, for signing `/step` dispatches

If those bindings/secrets are omitted, node-runtime steps will fail with
`NODE_RUNTIME_UNAVAILABLE` while edge steps continue to work.
