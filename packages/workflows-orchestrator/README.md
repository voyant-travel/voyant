# @voyant-travel/workflows-orchestrator

Postgres self-host orchestrator runtime for Voyant Workflows. Drives runs through
the tenant step handler over the v1 wire protocol. The package includes the
core state machine, in-memory test store, Postgres-backed production stores,
scheduler/wakeup support, and the self-host server helpers.

See [`docs/runtime-protocol.md`](../../docs/runtime-protocol.md) §2 +
§5 for the contract this implements.

```ts
import {
  trigger,
  resume,
  cancel,
  createInMemoryRunStore,
  type StepHandler,
} from "@voyant-travel/workflows-orchestrator";
import { handleStepRequest } from "@voyant-travel/workflows/handler";

// A StepHandler calls into the tenant's workflow code. In-process
// here via `handleStepRequest`; production self-host deployments normally
// use the Postgres-backed driver below.
const handler: StepHandler = async (req) => handleStepRequest(req);

const store = createInMemoryRunStore();

const record = await trigger(
  {
    workflowId: "send-reminder",
    workflowVersion: "1a2b3c4d",
    input: { bookingId: "bkg_42" },
    tenantMeta: {
      tenantId: "tnt_x",
      projectId: "prj_x",
      organizationId: "org_x",
    },
  },
  { store, handler },
);
// record.status is "completed" | "failed" | "waiting" | "cancelled" | …
```

## Surface

- **`trigger(args, deps)`** — create a `RunRecord`, drive it to
  terminal or parked, persist.
- **`resume(args, deps)`** — inject a waitpoint resolution (event /
  signal / manual token) on a parked run, drive forward, persist.
- **`cancel(args, deps)`** — flip a running / waiting run to
  `cancelled`.
- **`driveUntilPaused(record, { handler })`** — the core loop,
  exposed for advanced composition (e.g. custom scheduling, alarm
  handlers).
- **`createInMemoryRunStore()`** — test-friendly `RunRecordStore`.
- **`createStandaloneDriver({ db })`** — production Postgres
  workflow driver for `createApp()`.
- **`startSelfHostServer(options)`** — reference self-host server.
- **`runPostgresMigrations(options)`** — apply committed runtime migrations.

## Status model

`OrchestratorRunStatus`: `running | waiting | completed | failed |
cancelled | compensated | compensation_failed`.

Terminal: everything except `running` / `waiting`. `driveUntilPaused`
returns as soon as the run reaches a terminal state or parks on a
waitpoint the tenant registered.

## Why this package is separate from `@voyant-travel/workflows`

The authoring SDK (`@voyant-travel/workflows`) describes workflows and
provides the in-process executor. The orchestrator consumes that
SDK's wire protocol — it doesn't care how the tenant runs the body,
only about the request/response shape. Keeping orchestration outside the
authoring SDK prevents SDK consumers from taking on Postgres, scheduler, and
self-host server dependencies unless they are running workflows.
