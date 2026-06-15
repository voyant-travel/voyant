# @voyant-travel/workflows-cloud-adapter

Legacy tenant Worker adapter for Cloudflare-hosted workflow experiments. Managed
Voyant Cloud now executes workflow bundles on the hosted Node runtime; new app
code should use `@voyant-travel/workflows/client` to trigger or forward events
to the Cloud API.

## Worker entry

```ts
import "./workflows";
import { createCloudOrchestrator } from "@voyant-travel/workflows-cloud-adapter";

export default createCloudOrchestrator();
export { WorkflowRunDO } from "@voyant-travel/workflows-cloud-adapter";
```

If your build exports a workflow bundle value, passing it is harmless;
workflow registration still happens through module imports:

```ts
import workflows from "./workflows";
import { createCloudOrchestrator } from "@voyant-travel/workflows-cloud-adapter";

export const { fetch, WorkflowRunDO } = createCloudOrchestrator(workflows);
```

When passing adapter options such as `services`, `now`, or `logger`,
export `WorkflowRunDO` from the returned object as shown above. The
returned class is bound to the same options used by the Worker fetch
handler.

## Hybrid apps

For Hono/itty-style apps, mount the workflows routes alongside your
existing routes:

```ts
import { Hono } from "hono";
import "./workflows";
import { mountWorkflows } from "@voyant-travel/workflows-cloud-adapter";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));
mountWorkflows(app);

export default app;
export { WorkflowRunDO } from "@voyant-travel/workflows-cloud-adapter";
```

`mountWorkflows(app)` registers `/api/*` when the app exposes
`all(path, handler)`. If the app only exposes `fetch`, the adapter wraps
that fetch method and intercepts `/api/*`.

## Runtime behavior

The workflow SDK is node-only. This adapter no longer provides an edge/node
step split; the step handler executes through the single SDK runner path.

## Tenant wrangler.jsonc

Tenants author the run Durable Object binding. Voyant Cloud overlays the
platform bindings and secrets at publish time.

```jsonc
{
  "name": "my-voyant-workflows",
  "main": "src/worker.ts",
  "compatibility_date": "2026-05-01",
  "durable_objects": {
    "bindings": [
      {
        "name": "WORKFLOW_RUN_DO",
        "class_name": "WorkflowRunDO"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["WorkflowRunDO"]
    }
  ]
}
```

## Env contract

| Name | Required | Source | Purpose |
|---|---:|---|---|
| `WORKFLOW_RUN_DO` | yes | Tenant wrangler | Durable Object namespace for per-run state. |
| `WORKFLOW_MANIFESTS` | optional | Tenant/platform | KV namespace enabling `/api/manifests*` and `/api/events`. |
| `VOYANT_API_TOKENS` | production API | Tenant/platform | Comma-separated bearer tokens for public `/api/*` access. |
