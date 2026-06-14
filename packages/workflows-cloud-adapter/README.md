# @voyant-travel/workflows-cloud-adapter

Tenant Worker adapter for Voyant Cloud Workflows projects. It wraps the
lower-level Cloudflare orchestrator primitives so a workflow Worker can
export the public `/api/*` run surface and `WorkflowRunDO` without
hand-wiring dispatchers, step handlers, R2 bundle signing, or local
fallback behavior.

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

- When `STEP_RUNNER` is present and bundle env vars are configured,
  `runtime: "node"` steps dispatch to the platform step-runner
  Container fleet. The binding may point at the shared
  `voyant-step-runner` Worker or a platform-operated per-org dedicated
  runner; the adapter does not distinguish between them.
- When `STEP_RUNNER` is absent, `runtime: "node"` steps run inline in
  the tenant Worker isolate. This keeps `wrangler dev` usable without
  Docker, R2, or platform-injected bindings.
- Edge steps always run in the tenant Worker isolate.

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

At publish time the platform injects the step-runner namespace binding:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "STEP_RUNNER",
        "class_name": "StepRunner",
        "script_name": "voyant-step-runner"
      }
      // Enterprise tenants may receive script_name:
      // "voyant-step-runner-{org}".
    ]
  }
}
```

## Env contract

| Name | Required | Source | Purpose |
|---|---:|---|---|
| `WORKFLOW_RUN_DO` | yes | Tenant wrangler | Durable Object namespace for per-run state. |
| `STEP_RUNNER` | production node steps | Platform-injected | Durable Object namespace for the shared or dedicated step-runner Container fleet. |
| `WORKFLOW_MANIFESTS` | optional | Tenant/platform | KV namespace enabling `/api/manifests*` and `/api/events`. |
| `VOYANT_API_TOKENS` | production API | Tenant/platform | Comma-separated bearer tokens for public `/api/*` access. |
| `VOYANT_WORKFLOW_BUNDLE_URL_PREFIX` | with `STEP_RUNNER` | Platform-injected | R2 S3 API prefix: `https://<account>.r2.cloudflarestorage.com/<bucket>`. |
| `VOYANT_WORKFLOW_BUNDLE_KEY` | with `STEP_RUNNER` | Platform-injected | R2 object key for this version's `container.mjs`. |
| `VOYANT_WORKFLOW_BUNDLE_HASH` | with `STEP_RUNNER` | Platform-injected | SHA-256 hash for the bundle bytes. |
| `VOYANT_WORKFLOW_BUNDLE_R2_ACCESS_KEY_ID` | with `STEP_RUNNER` | Secret | Read-only R2 access key id. |
| `VOYANT_WORKFLOW_BUNDLE_R2_SECRET_ACCESS_KEY` | with `STEP_RUNNER` | Secret | Read-only R2 secret access key. |
| `VOYANT_WORKFLOW_STEP_AUTH_SECRET` | recommended with `STEP_RUNNER` | Secret | HMAC secret for `x-voyant-step-auth` on step dispatches. |
| `VOYANT_WORKFLOW_BUNDLE_URL_TTL_SECONDS` | optional | Platform-injected | Signed bundle URL TTL. Defaults to `300`. |

`VOYANT_WORKFLOW_BUNDLE_R2_ACCOUNT_ID` and
`VOYANT_WORKFLOW_BUNDLE_R2_BUCKET` can override the account id and
bucket parsed from `VOYANT_WORKFLOW_BUNDLE_URL_PREFIX`.
