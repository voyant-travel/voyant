# apps/workflows-selfhost-cloudflare-worker

Reference single-tenant Cloudflare Worker for legacy self-hosted Voyant
Workflows experiments. The workflow bundle is imported directly into the Worker
and steps execute through the SDK's single node-only handler path.

Managed and recommended self-host workflow runtimes are Node-based. Use
`apps/workflows-selfhost-node-server` or the Postgres-backed
`@voyant-travel/workflows-orchestrator-node` driver for production self-hosting.

## What You Get

- One Worker that hosts the public orchestration API and step execution.
- One Durable Object per run for run state and wakeups.
- No dispatch namespace, no container pool, and no edge/node step split.

## Deploy Flow

```bash
voyant workflows deploy --target cloudflare --file ./src/workflows.ts
voyant workflows doctor --target cloudflare
voyant workflows deploy --target cloudflare --file ./src/workflows.ts --apply
```

`--apply` wraps `pnpm --filter @voyant-travel/workflows-selfhost-cloudflare-worker deploy`.
Without it, the CLI only builds and stages `src/bundle.mjs`.

## Public API Auth

Set `VOYANT_API_TOKENS` (comma-separated bearer tokens) if you want the public
`/api/runs/*` surface protected. Leaving it unset is acceptable for local
experimentation, not for production.
