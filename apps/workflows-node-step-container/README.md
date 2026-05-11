# @voyantjs/workflows-node-step-container

Reference Cloudflare Container server that executes workflow steps
declared with `runtime: "node"`. The orchestrator (running as a Worker
+ Durable Object) dispatches individual step invocations to a container
running this package via `createCfContainerStepRunner` from
`@voyantjs/workflows-orchestrator-cloudflare`.

Voyant Cloud consumes this package from its shared
`voyant-step-runner` fleet and from platform-operated per-org dedicated
runner fleets. Enterprise dedicated runners use the same package and
protocol; only the injected Durable Object binding target changes.

## Protocol

The orchestrator's runner sends `POST /step` with:

```json
{
  "runId": "run_...",
  "workflowId": "process-upload",
  "workflowVersion": "v1",
  "stepId": "hash-source",
  "attempt": 1,
  "input": { ... },
  "options": { "machine": "standard-2", "timeout": "30s" }
}
```

Optional header `x-voyant-step-auth: <hmac>` is verified against
`VOYANT_STEP_SECRET` when set.

Response is a `StepJournalEntry`:

```json
{
  "attempt": 1,
  "status": "ok",
  "output": { "hash": "sha256:..." },
  "startedAt": 1776451106797,
  "finishedAt": 1776451106897,
  "runtime": "node"
}
```

## Package use

```bash
pnpm add @voyantjs/workflows-node-step-container
```

The package entry point starts the HTTP server:

```bash
voyant-workflows-node-step-container
```

Container images can also run the built module directly:

```bash
node node_modules/@voyantjs/workflows-node-step-container/dist/server.js
```

## Wiring

### Orchestrator side (Worker + DO)

```ts
import { createCfContainerStepRunner } from "@voyantjs/workflows-orchestrator-cloudflare";
import { createStepHandler } from "@voyantjs/workflows/handler";

export default {
  fetch(req, env) {
    const nodeStepRunner = createCfContainerStepRunner({
      namespace: env.NODE_STEP_POOL,
    });
    const stepHandler = createStepHandler({ nodeStepRunner });
    // ... wire stepHandler into handleWorkerRequest / DO
  },
};
```

### Wrangler binding (orchestrator's `wrangler.jsonc`)

```jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "WORKFLOW_RUN_DO", "class_name": "WorkflowRunDO" },
      { "name": "NODE_STEP_POOL", "class_name": "NodeStepContainer" }
    ]
  },
  "containers": [
    {
      "class_name": "NodeStepContainer",
      "image": "./apps/workflows-node-step-container/Dockerfile",
      "instance_type": "standard-2",
      // "lite" | "basic" | "standard-1" | "standard-2" | "standard-3" | "standard-4"
      "max_instances": 50
    }
  ]
}
```

### Container class (orchestrator Worker)

```ts
import { Container } from "@cloudflare/containers";

export class NodeStepContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}
```

## Build

```bash
# 1. Build your workflow bundle separately for single-tenant images
voyant workflows build --file ./src/workflows.ts --out ./dist
cp ./dist/bundle.mjs ./apps/workflows-node-step-container/bundle.mjs

# 2. Deploy via wrangler (builds + pushes the image)
wrangler deploy
```

## Bundle modes

- **Single tenant** — set `WORKFLOW_BUNDLE` to a local `container.mjs`.
- **Multi tenant** — send `bundle: { url, hash }` in each dispatch
  payload. The server fetches the signed URL, verifies the SHA-256 hash,
  imports the bundle, and caches it by hash.

The dispatch payload includes the current journal slice, and the server
stops after the target step has executed so sibling node steps do not
rerun during body replay.
