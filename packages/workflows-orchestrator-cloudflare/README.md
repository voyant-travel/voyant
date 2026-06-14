# @voyant-travel/workflows-orchestrator-cloudflare

Cloudflare Worker + Durable Object adapter for
[`@voyant-travel/workflows-orchestrator`](../workflows-orchestrator). Composes
the protocol-agnostic state machine with DO-backed storage and a
pluggable **step dispatcher** that delivers step requests to wherever
workflow code lives.

This package is the building block; the deployable artifact lives in
[`apps/workflows-orchestrator-worker`](../../apps/workflows-orchestrator-worker),
which wires it into a `wrangler.jsonc` + default-exports.

## Picking a dispatcher

The orchestrator forwards step requests through a `StepDispatcher`. Pick
the factory that matches your deployment:

| Factory | Use case | Bindings needed |
|---|---|---|
| `createInlineDispatcher` | Single-Worker (workflows + API in same isolate) | None |
| `createServiceBindingDispatcher` | Two-Worker (orchestrator + sibling workflows Worker) | Service binding |
| `createHttpDispatcher` | Cross-host (e.g. CF orchestrator → Node-side workflows) | HTTP endpoint |

Hosted multi-tenant providers implement custom `StepDispatcher`s in
their own deployment code — multi-tenancy is a deployment concern, not
a runtime one, so it doesn't ship here.

```ts
import {
  handleWorkerRequest,
  handleDurableObjectRequest,
  handleDurableObjectAlarm,
  createServiceBindingDispatcher,
} from "@voyant-travel/workflows-orchestrator-cloudflare";

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
      dispatcher: createServiceBindingDispatcher({ binding: this.env.WORKFLOWS }),
    };
  }
}
```

## HTTP surface (exposed by `handleWorkerRequest`)

| Verb + path | Purpose |
|---|---|
| `POST /api/runs` | Trigger a new run. Body: `{ workflowId, workflowVersion, input, tenantMeta, runId? }`. |
| `GET  /api/runs/:id` | Fetch the current `RunRecord`. |
| `POST /api/manifests` | Register a workflow manifest for an environment when `manifestStore` is configured. |
| `GET  /api/manifests/:env` | Fetch the current workflow manifest for an environment. |
| `GET  /api/schedules/:env` | List manifest schedules with computed `nextRunAt`; when `scheduleStateStore` is configured, rows also include `lastFireAt`, `lastRunId`, `lastError`, `lockedUntil`, and `lastSuccessfulRunAt`. |
| `POST /api/events` | Route an event through the registered manifest and trigger matching workflows. |
| `POST /api/runs/:id/resume` | Start a new run from a failed parent run. Body: `{ input?, workflowId?, resumeFromStep?, seedResults?, runId?, tags?, triggeredByUserId? }`. |
| `POST /api/runs/:id/events` | Inject an `EVENT` waitpoint resolution. |
| `POST /api/runs/:id/signals` | Inject a `SIGNAL` waitpoint resolution. |
| `POST /api/runs/:id/tokens/:tokenId` | Inject a `MANUAL` (token) waitpoint resolution. |
| `POST /api/runs/:id/cancel` | Cancel a parked / running run. |

Injection bodies are `{ eventType, payload? }` / `{ name, payload? }`
/ `{ payload? }` respectively.

If the parent id on `/api/runs/:id/resume` is not stored in this
orchestrator, pass `workflowId`, `resumeFromStep`, and `seedResults`
to resume from an external workflow-runs parent.

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
