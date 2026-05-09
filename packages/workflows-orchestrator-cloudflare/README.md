# @voyantjs/workflows-orchestrator-cloudflare

Cloudflare Worker + Durable Object adapter for
[`@voyantjs/workflows-orchestrator`](../workflows-orchestrator). Composes the
protocol-agnostic state machine with DO-backed storage and a pluggable
**step dispatcher** that delivers step requests to wherever the
workflow code lives.

This package is the building block; the deployable artifact lives in
[`apps/workflows-orchestrator-worker`](../../apps/workflows-orchestrator-worker), which
wires it into a `wrangler.jsonc` + default-exports.

## Picking a dispatcher

The orchestrator forwards step requests through a `StepDispatcher`. Pick
the factory that matches your deployment:

| Factory | Use case | Bindings needed |
|---|---|---|
| `createWfpDispatcher` | Multi-tenant via Workers-for-Platforms (Voyant Cloud) | WfP dispatch namespace |
| `createServiceBindingDispatcher` | Self-host: orchestrator + workflows are separate Workers | A service binding |
| `createInlineDispatcher` | Self-host single-Worker (workflows + API in same isolate) | None |
| `createHttpDispatcher` | Cross-host (e.g. CF orchestrator → Node-side workflows) | An HTTP endpoint |

```ts
import {
  handleWorkerRequest,
  handleDurableObjectRequest,
  handleDurableObjectAlarm,
  createWfpDispatcher,
} from "@voyantjs/workflows-orchestrator-cloudflare";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return handleWorkerRequest(req, { runDO: env.WORKFLOW_RUN_DO });
  },
} satisfies ExportedHandler<Env>;

export class WorkflowRunDO implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  fetch(req: Request): Promise<Response> {
    return handleDurableObjectRequest(req, this.deps());
  }

  alarm(): Promise<void> {
    return handleDurableObjectAlarm(this.deps());
  }

  private deps() {
    return {
      storage: this.state.storage,
      // Multi-tenant via WfP — swap for createInlineDispatcher,
      // createServiceBindingDispatcher, or createHttpDispatcher
      // depending on where workflow code lives.
      dispatcher: createWfpDispatcher({ namespace: this.env.DISPATCHER }),
    };
  }
}
```

## HTTP surface (exposed by `handleWorkerRequest`)

| Verb + path | Purpose |
|---|---|
| `POST /api/runs` | Trigger a new run. Body: `{ workflowId, workflowVersion, input, tenantMeta, runId? }`. |
| `GET  /api/runs/:id` | Fetch the current `RunRecord`. |
| `POST /api/runs/:id/events` | Inject an `EVENT` waitpoint resolution. |
| `POST /api/runs/:id/signals` | Inject a `SIGNAL` waitpoint resolution. |
| `POST /api/runs/:id/tokens/:tokenId` | Inject a `MANUAL` (token) waitpoint resolution. |
| `POST /api/runs/:id/cancel` | Cancel a parked / running run. |

Injection bodies are `{ eventType, payload? }` / `{ name, payload? }`
/ `{ payload? }` respectively.

## Durable Object model

One DO per run, keyed by `idFromName(runId)`. The DO's transactional
storage holds the `RunRecord` under `record`. Every write reconciles
`setAlarm` against the earliest DATETIME waitpoint, so `ctx.sleep(…)`
wakes the run at the correct wall-clock time via the CF runtime's
alarm delivery.

## Testing

Two suites:

- **`pnpm test`** — plain Node, structural mocks for DO storage and
  dispatch namespace. Fast; runs in CI without any CF toolchain.
- **`pnpm test:workers`** — real workerd via
  `@cloudflare/vitest-pool-workers`. Declares a `TestWorkflowRunDO`
  in `test-worker/wrangler.jsonc`, exercises DO storage + alarm
  delivery end-to-end. Proves the adapter's structural types line
  up with the concrete CF runtime.

## Structural typing

The adapter ships structural types
(`DurableObjectStorageLike`, `DispatchNamespaceLike`,
`DurableObjectNamespaceLike`) instead of taking a hard dep on
`@cloudflare/workers-types`. Tests run in plain Node with in-memory
fakes; real CF types are a structural supertype and assign cleanly.

## What this package does not include

Production concerns that belong in the cloud control plane
(voyant-cloud), not in the protocol adapter:

- Authentication on the `/api/runs/*` surface. `handleWorkerRequest`
  accepts a `verifyRequest` dep; wire your tenant-token / HMAC check
  there.
- Cross-run list and filter queries (each DO holds exactly one run).
- Stream-chunk egress to Queues / SSE. Chunks accumulate on the
  record; a production deployment would fan them out as they arrive.
- Idempotency on retried trigger requests.
