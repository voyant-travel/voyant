# apps/workflows-orchestrator-worker

Legacy Cloudflare Worker that hosts the Voyant Workflows orchestrator with a
Durable Object per run. The current supported workflow execution model is
node-only: use `@voyant-travel/workflows-orchestrator-node` for self-hosting or
`@voyant-travel/workflows/client` for managed Cloud forwarding.

This app remains as a compatibility reference for older Worker/DO deployments.
It does not provide a Cloudflare edge/Node step split, container pool, R2 bundle
loader, or managed Cloud runtime.

## What You Get

- `src/worker.ts`: default `fetch` handler and `WorkflowRunDO` class.
- `wrangler.jsonc`: `WORKFLOW_RUN_DO`, optional manifest/schedule KV bindings,
  and a service binding to a sibling workflows Worker.
- Unit tests proving the exports and DO routing.

Public HTTP surface is provided by
`@voyant-travel/workflows-orchestrator-cloudflare`:

| Verb + path | Purpose |
| --- | --- |
| `POST /api/runs` | Trigger a run. |
| `GET /api/runs/:id` | Fetch a run record. |
| `POST /api/manifests` | Register a workflow manifest when KV is configured. |
| `POST /api/events` | Route an event through the registered manifest. |
| `POST /api/runs/:id/events` | Resolve an event waitpoint. |
| `POST /api/runs/:id/signals` | Resolve a signal waitpoint. |
| `POST /api/runs/:id/tokens/:tokenId` | Resolve a manual token waitpoint. |
| `POST /api/runs/:id/cancel` | Cancel a parked or running run. |

## Running

```bash
pnpm --filter @voyant-travel/workflows-orchestrator-worker check-types
pnpm --filter @voyant-travel/workflows-orchestrator-worker test
pnpm --filter @voyant-travel/workflows-orchestrator-worker dev
pnpm --filter @voyant-travel/workflows-orchestrator-worker deploy
```

For new production deployments, prefer the Node/Postgres runtime instead of this
legacy Worker/DO adapter.
