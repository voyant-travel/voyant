# Workflows runtime — architecture

Status: design / pre-implementation. Closes voyantjs/voyant#514. Unblocks voyantjs/voyant#515 and a small family of follow-up issues that migrate existing inline subscribers onto workflows (§20).

This doc describes the workflow runtime as a **first-class, framework-owned, self-host-first** primitive. `@voyantjs/workflows` is THE workflow engine for Voyant; modules and plugins ship workflows and event filters; `createApp()` defaults to the self-host composition with one config field (`db`); managed deployment is a wrapper that lives in voyant-cloud, not in this repo. Operators who want a different orchestrator implement the driver interface and assemble from primitives.

## 1. Why this exists

Three forces converge on this work:

**1.** `trigger.on()` (`packages/workflows/src/trigger.ts:131`) and `WorkflowManifest.eventFilters` (`packages/workflows/src/protocol/index.ts:85`) ship as SDK declarations with no runtime. Calling `trigger.on(...)` throws synchronously. The orchestrator has no event ingest, no manifest registration, no filter matcher. Any event → workflow flow has to fall back to one of three workarounds: poll a flag column, do unbounded work inline in a Workers subscriber (CPU/wall-time unsafe), or log + skip + ask ops to run a CLI. All three are explicitly broken paths in `docs/architecture/event-delivery-and-durable-execution-policy.md`. Concrete callsites that picked workaround #3 today: `templates/operator/src/api/catalog-bridge.ts:247-264`, `templates/operator/src/api/promotion-scheduled.ts:82-91`.

**2.** `event-delivery-and-durable-execution-policy.md` §6 already mandates *"use durable jobs or workflows for retryable background execution."* That policy implies a single, framework-owned engine — but the framework doesn't ship one in a usable form. The policy can't be enforced because there is no runtime to enforce it against.

**3.** The team already removed Hatchet and Trigger.dev (per `MEMORY.md` Workflow orchestration), committing to first-party orchestration. The remaining work is to finish that commitment: make the engine reachable from any module's `eventBus.emit()`, with no per-template wiring, in both self-host and managed-cloud deployment shapes.

This doc resolves all three.

## 2. Goals

1. **Workflows are first-class.** A module that declares a workflow and a `trigger.on()` filter has those workflows fire automatically when the named event is emitted, regardless of which template hosts the module, regardless of deployment shape, with no template-level glue.
2. **Self-host is the primary architectural unit.** The runtime defaults to a single-tenant, in-process composition. `createApp({ workflows: { db } })` is enough to run workflows. Multi-tenancy, customer dashboards, billing, and scoped tokens are layered on top by managed-cloud deployments — they do not live in the runtime.
3. **Two reference deployment shapes ship together.** Mode 1 — all on Cloudflare (Workers + DO + KV + Sandboxes/Containers, reusing the existing `workflows-orchestrator-cloudflare` package). Mode 2 — all in Docker (single Node process or sibling-process pair sharing Postgres; extends the existing `workflows-orchestrator-node` package with manifest store + idempotency wiring).
4. **No env-var-based driver selection.** `createApp({ workflows: ... })` is explicit. The default is Mode 2 (`{ db }` shorthand). Mode 1 requires explicit factory wiring. Misconfiguration is a startup error, not a runtime surprise.
5. **Modules and plugins are the primary declaration sites.** `@voyantjs/promotions` ships `bulkReindexProducts` and `trigger.on("promotion.changed", { ... })` from its package. `definePlugin({ workflows, eventFilters })` exposes the same to plugins. Templates don't see the manifest unless they're adding workflows of their own.
6. **Durable run execution; non-durable event delivery in v1.** Once an event has been ingested by the driver, the resulting run is durable: persisted to Postgres or DO storage, retried on transient failures, replay-safe, surviving process restart. Event *ingest* itself is at-most-once in v1 because the EventBus forwarder is fire-and-forget, matching the in-process EventBus's existing semantics. The upgrade path to at-least-once durable ingest (an outbox table on the emitter side) is designed-for in §16.2 and ships as a separate piece of work.
7. **Closes #514 and unblocks #515.** When this lands the `affected.kind === "all"` reindex paths in promotions become a routine `trigger.on(...)` declaration plus a workflow body, not a doc-flagged hole.

## 3. Non-goals (for v1)

Each has an upgrade path and at least one is mentioned by name in §21.

- **Static AST collection (`voyant workflows build`).** Runtime registration is sufficient and matches every other extensibility point in the codebase. A static collector is a future optimization.
- **D1 / SQLite-backed state or manifest storage.** Mode 1 uses DO storage for state and KV for manifests. Mode 2 uses Postgres for both. D1 is a credible future variant for either replacing KV (queryable manifest history) or as an alternative state store, but it isn't load-bearing in v1 and we skip the test-matrix expansion.
- **Cross-environment routing.** Production events do not match preview filters. Default off, no opt-in flag.
- **Dead-letter queue / replay of dropped events.** v1 logs + counters. Designed-for in §16.2.
- **Wildcard event types.** `trigger.on("booking.*", ...)` is not supported in v1. Exact match only.
- **`waitForEvent` / `waitForSignal` over the same protocol.** Already work via `POST /api/runs/:id/{events,signals}`; out of scope here.
- **Migration of existing inline subscribers, except the one closing #515.** PR4 demonstrates the runtime by migrating the `affected.kind === "all"` reindex paths (the `#515` work). All other candidates listed in §20 (snapshot capture, per-product reindex, pricing reindex, channel push, CMS sync subscribers in `packages/plugins/{payload-cms,sanity-cms}`) stay inline pending separate follow-up issues. This work enables them; PR4 performs only the one migration that closes #515.
- **Full `WorkflowsClient` HTTP method coverage.** Only the methods the runtime needs (`trigger`, `registerManifest`, `ingestEvent`) are implemented in v1. The rest stay as the existing throwing proxy.
- **Durable at-least-once event ingest.** Ingest is fire-and-forget over the in-process EventBus forwarder in v1. Outbox-backed ingest is the upgrade path (§16.2).
- **Cross-run queries / dashboards in self-host Mode 1.** The DO-per-run storage model in Mode 1 has no native cross-run query layer. Self-host Mode 1 operators who want a dashboard either accept "open this specific runId" UX, run Mode 2 instead, or stand up their own index. Voyant Cloud handles this in its repo (§9).
- **Engine control-plane fields that are declared but unwired today.** A capability audit (run before this work started) confirmed that `WorkflowConfig.concurrency`, `WorkflowConfig.schedule`, and several `TriggerOptions` fields (`debounce`, `delay`, `ttl`, `priority`, `concurrencyKey`) are present in the SDK type surface but have zero enforcement in the orchestrator core. Replay-from-step (`replay({ fromStepId })`) and the unimplemented `WorkflowsClient` methods (`replay`, `retry`, `get`, `list`, `mintAccessToken`) are similarly stubbed. These are real engine gaps; they're tracked as separate follow-up issues. **The single exception is `TriggerOptions.idempotencyKey`** — this work depends on it for ingest dedup (§15.2), so PR1 wires it end-to-end as part of #514's scope. Everything else listed in this bullet is explicitly out of scope.

## 4. Architectural stance

`@voyantjs/workflows` is the workflow runtime. Not a runtime, not one option among several. There is exactly one orchestrator state machine in the codebase (already in `packages/workflows-orchestrator/src/orchestrator.ts`); we wrap it in two adapter compositions and treat the engine as part of the framework's standard equipment.

The architecture is **self-host first.** The runtime carries no tenant identity by default. Manifest registration is "the framework reads its own modules at boot" — no HTTP endpoint to set up, no token to mint, no port to expose unless the operator opts in. Most events are emitted by the same process that runs the workflow, so there is no network boundary, so no auth needed. Multi-tenancy, scoped tokens, and customer dashboards are wrapper concerns that live in voyant-cloud, not in the runtime.

What this means in practice:

1. **Modules ship workflows.** A module's `index.ts` exports `workflows: WorkflowDefinition[]` and `eventFilters: EventFilterRuntimeEntry[]` the same way it already exports `service`, `routes`, `subscribers`, `linkable`. The `Module` interface in `packages/core/src/module.ts` gets two new optional fields.
2. **Plugins ship workflows.** `definePlugin({ workflows, eventFilters, ... })` parallels the existing `modules`, `extensions`, `subscribers`, `links` fields.
3. **`createApp()` is the wiring point.** It collects workflows + event filters from every module + plugin, hands them to the configured driver, and the driver does everything else. Templates that don't add their own workflows don't touch the workflow runtime at all.
4. **`trigger.on()` is the standard mechanism for event-driven async work.** Inline `eventBus.subscribe(...)` becomes the rare case (observer-only, no retry, no durability) and the policy doc says so.
5. **The driver is part of the deployment contract.** Templates pick a driver factory at `createApp()` call site. The default is `createNodeStandaloneDriver({ db })` — implicit when you pass `workflows: { db }`. CF deployments use `createCloudflareEdgeDriver({...})`. There is no "no driver" mode. Misconfiguration throws on startup.
6. **Operators who want something else are off the golden path.** They implement `WorkflowDriver` themselves and pass it in. No framework affordance, no migration help, no plugin compatibility guarantees. This is the explicit deal.

## 5. Architecture overview

The runtime is one piece of code parameterized by adapters. Two reference compositions ship: Mode 1 (Cloudflare) and Mode 2 (Docker / pure Node).

```
              ┌─────────────────────────────────────────────────────────┐
              │  Module / Plugin code                                   │
              │                                                         │
              │  export const workflows = [bulkReindexProducts]         │
              │  export const eventFilters = [                          │
              │    trigger.on("promotion.changed", {                    │
              │      target: bulkReindexProducts,                       │
              │      where: { eq: [...] },                              │
              │      input: { object: { ... } },                        │
              │    }),                                                  │
              │  ]                                                      │
              └─────────────────────┬───────────────────────────────────┘
                                    │ collected by createApp()
                                    ▼
              ┌─────────────────────────────────────────────────────────┐
              │  Manifest                                               │
              │   { workflows[], eventFilters[], environment, ... }     │
              └─────────────────────┬───────────────────────────────────┘
                                    │ driver.registerManifest(manifest)
                                    ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │  WorkflowDriver  — composition of adapters                         │
   │                                                                    │
   │  ┌─────────────────────────┐    ┌───────────────────────────────┐ │
   │  │ Mode 2 — Docker / Node  │    │ Mode 1 — Cloudflare           │ │
   │  │                         │    │                               │ │
   │  │  state:    Postgres     │    │  state:    DO storage         │ │
   │  │  time:     SKIP LOCKED  │    │  time:     DO alarms          │ │
   │  │  manifest: Postgres     │    │  manifest: KV                 │ │
   │  │  dispatch: in-process   │    │  dispatch: dispatch namespace │ │
   │  │            (or sibling) │    │            + Sandboxes for    │ │
   │  │                         │    │            node-runtime steps │ │
   │  └─────────────────────────┘    └───────────────────────────────┘ │
   └──────────────────────┬─────────────────────────────────────────────┘
                          │ same orchestrator state machine
                          ▼
              ┌─────────────────────────────────────────────────────────┐
              │  Shared core: packages/workflows-orchestrator           │
              │  (RunRecord, journal, trigger/resume/cancel, drive)     │
              └─────────────────────────────────────────────────────────┘

   ─── event flow (independent of mode) ─────────────────────────────────
                          ┌──────────────────────────────────┐
                          │  eventBus.emit("promotion...",   │
                          │     { affected: { kind: "all" }, │
                          │       offerId, source })         │
                          └──────────────────┬───────────────┘
                                             │ framework-installed forwarder
                                             │ stamps metadata.eventId (ULID)
                                             ▼
                          ┌──────────────────────────────────┐
                          │  driver.ingestEvent(envelope)    │
                          └──────────────────┬───────────────┘
                                             │ load manifest, eval where,
                                             │ apply input mapper,
                                             │ trigger() per match
                                             ▼
                          ┌──────────────────────────────────┐
                          │  one or more runs created        │
                          └──────────────────────────────────┘
```

Three properties to highlight:

- **The orchestrator state machine is shared.** Both modes wrap the existing pure functions in `packages/workflows-orchestrator/src/orchestrator.ts`. Mode 1 plugs in DO-backed state + alarms (existing in `workflows-orchestrator-cloudflare`). Mode 2 plugs in Postgres-backed state via the existing `voyant_snapshot_runs` table and the existing `createPersistentWakeupManager` time wheel from `workflows-orchestrator-node`. Journal events, retry semantics, compensation order, and waitpoint kinds are identical.
- **Filter matching lives at the driver boundary.** The same event router code (`packages/workflows-orchestrator/src/event-router.ts`, new) runs inside Mode 2's in-process driver and inside Mode 1's CF orchestrator Worker. It evaluates the same `where` predicate against the same manifest format.
- **The HTTP boundary is opt-in.** Mode 2's default has no network boundary at all — `driver.ingestEvent(...)` is an in-process function call. Mode 1 has Worker→DO RPC for the run state but still no HTTP boundary on the application side. The optional HTTP ingest adapter (§15.4) mounts `POST /api/events` and `POST /api/manifests` when external emitters need them; managed-cloud always mounts it.

## 6. The `WorkflowDriver` abstraction

The runtime presents two interfaces: a small mandatory **execution** interface (`WorkflowDriver`) and an optional **admin** interface (`WorkflowAdmin`) for read-side operations. Splitting them keeps the contract every driver must satisfy minimal, while leaving room for richer dashboard and debug tooling on drivers that can support it.

### 6.1 `WorkflowDriver` — execution (mandatory)

Lives at `packages/workflows/src/driver.ts`:

```ts
export interface WorkflowDriver {
  /** Called once at createApp() boot. Idempotent — same manifest body returns same versionId. */
  registerManifest(args: {
    environment: EnvironmentName
    manifest: WorkflowManifest
  }): Promise<{ versionId: string }>

  /** Trigger a workflow run by id or handle. */
  trigger<TIn, TOut>(
    workflow: WorkflowDefinition<TIn, TOut> | string,
    input: TIn,
    opts?: TriggerOptions,
  ): Promise<Run<TOut>>

  /** Ingest one event; returns matched filters and the runs created. */
  ingestEvent(args: IngestEventArgs): Promise<IngestEventResponse>

  /** Read the registered manifest, primarily for tests + boot mismatch detection. */
  getManifest(args: {
    environment: EnvironmentName
  }): Promise<WorkflowManifest | null>

  /** Drain in-flight steps, refuse new triggers, await time wheel exit. */
  shutdown?(opts?: { gracefulMs?: number }): Promise<void>
}
```

Every driver must implement these five methods. Note the absence of `projectId`: the runtime is single-tenant by default. Multi-tenancy is added by managed-cloud as a layer in front of the driver — the driver still only sees one tenant's manifest at a time.

### 6.2 `WorkflowAdmin` — read-side operations (optional)

```ts
export interface WorkflowAdmin {
  listRuns(opts?: ListRunsOptions): Promise<{ runs: RunSummary[]; nextCursor?: string }>
  getRun(runId: string): Promise<RunDetail | null>
  cancelRun(runId: string, opts?: { reason?: string; compensate?: boolean }): Promise<void>
  /** Subscribe to journal events for a run. Returns an async iterator. */
  streamRun(runId: string): AsyncIterable<StreamEvent>
}
```

Drivers expose this by declaring `admin?: WorkflowAdmin` on the returned driver object. `apps/workflow-runs-dashboard` checks for `driver.admin` and falls back to a "admin not available for this driver" empty state when absent.

- **Mode 2 (Postgres)**: implements `admin` natively against `voyant_snapshot_runs` + `voyant_wakeups` (existing tables in `@voyantjs/workflows-orchestrator-node`). List, search, filter, all relational queries are free.
- **Mode 1 (DO/KV)**: implements `getRun(runId)` (single-DO read) and `cancelRun(runId)` (DO RPC). `listRuns` is **not implemented** — the framework returns "admin.list not supported in CF Mode 1; bring your own index." Voyant Cloud's wrapper provides one.
- **InMemory** (test-only): partial admin sufficient for compliance tests.

The split lets us add admin operations later without breaking driver implementations that ship before those operations exist.

### 6.3 Driver factories

Driver factories are **functions that the framework invokes after the container is built**, not pre-constructed driver objects. This is what lets `createApp()` thread the module container, logger, and other framework deps into the driver without a setter API or post-construction wrapper.

```ts
export type DriverFactoryDeps = {
  services: ModuleContainerView   // wired by createApp() after container assembly
  logger:   Logger
  db?:      DatabaseClient        // present when caller passed workflows.db
  now?:     () => number
}

export type DriverFactory = (deps: DriverFactoryDeps) => WorkflowDriver

// Concrete factories return DriverFactory, not WorkflowDriver:
export function createNodeStandaloneDriver(opts: NodeStandaloneOpts): DriverFactory
export function createCloudflareEdgeDriver(opts: CloudflareEdgeOpts): DriverFactory
export function createInMemoryDriver(opts?: InMemoryOpts): DriverFactory
```

The user-facing shape:

```ts
// Mode 2 — Node standalone driver
createApp({
  workflows: {
    driver: () => createNodeStandaloneDriver({ db }),
  },
})
// createApp() invokes the returned DriverFactory with { services, logger, now? }.

// Mode 1 — explicit factory
createApp({
  workflows: {
    driver: createCloudflareEdgeDriver({
      orchestratorNamespace: env.WORKFLOW_RUN_DO,
      manifestKv:            env.WORKFLOW_MANIFESTS,
      dispatchNamespace:     env.DISPATCHER,
      nodeStepPool:          env.NODE_STEP_POOL,
      environment:           "production",
    }),
  },
})
```

`createCloudflareEdgeDriver({...})` returns a `DriverFactory`. `createApp()` invokes it with `{ services, logger, ... }` once the container is built, and stores the resulting `WorkflowDriver`. The driver itself never sees a setter; the factory closes over its environment-specific options and reads framework-supplied deps from its argument.

Defaults: when `createApp()` is called with `workflows: { db }` (no explicit `driver`), the framework synthesizes a `DriverFactory` that calls `createNodeStandaloneDriver({ db })`. Mode 1 always requires explicit factory wiring — there's no auto-detection of "I'm running on a Worker."

A driver's `admin` interface lives on the constructed `WorkflowDriver` object; the framework checks `driver.admin` after construction and routes dashboard reads accordingly.

### 6.4 Driver compliance test suite

A shared test file `packages/workflows-orchestrator/src/__tests__/driver-compliance.test.ts` runs against every driver implementation. It is parameterized:

```ts
function runDriverComplianceSuite(name: string, makeDriver: () => Promise<WorkflowDriver>) {
  describe(`${name} driver compliance`, () => {
    test("trigger creates a run with status=running", async () => { ... })
    test("trigger with idempotencyKey deduplicates", async () => { ... })
    test("ingestEvent matches a where predicate and triggers", async () => { ... })
    test("ingestEvent with no matches returns ok=true matches=[]", async () => { ... })
    test("ingestEvent with predicate eval error skips that filter", async () => { ... })
    test("ingestEvent dedupes via metadata.eventId across retries", async () => { ... })
    test("DATETIME waitpoint resumes after due time", async () => { ... })
    test("EVENT waitpoint resumes via /events injection", async () => { ... })
    test("SIGNAL waitpoint resumes via /signals injection", async () => { ... })
    test("step retry on transient error follows backoff", async () => { ... })
    test("explicit ctx.compensate() runs registered compensations in LIFO order", async () => { ... })
    test("step body throwing runs the step's own compensate() then unwinds previous steps' compensations", async () => { ... })
    test("cancel transitions running → cancelled (no implicit compensation)", async () => { ... })
    test("cancelling a parent surfaces RUN-waitpoint error to a parked parent run (cascade)", async () => { ... })
    // ... etc
  })
}

runDriverComplianceSuite("InMemory", async () => createInMemoryDriver())
runDriverComplianceSuite("Mode 2 (Postgres)", async () => createNodeStandaloneDriver({ db: testDb() }))
runDriverComplianceSuite("Mode 1 (CF edge)", async () => createCloudflareEdgeDriver({
  /* runs against an in-process orchestrator-worker fixture */
}))
```

This is the contract. Anything that doesn't pass this suite is not a driver.

**Note on cancel semantics.** The orchestrator core's `cancel()` (`packages/workflows-orchestrator/src/orchestrator.ts:7,298`) **does not run compensations** — it marks the run cancelled and best-effort aborts the in-flight step. Compensations only run via the explicit `ctx.compensate()` path or via step failure unwinding. If we ever want cancel-runs-compensations as a default, that's a deliberate engine behavior change tracked separately, not a compliance test rewrite.

## 7. Mode 2 — pure Node deployment

The default. Single Node process (or sibling-process pair) running app + orchestrator + step execution, with Postgres as the only external dependency. Everything in Docker.

**Mode 2 extends the existing `@voyantjs/workflows-orchestrator-node` package**, not a new one. That package already ships a Postgres state store, a persistent wakeup manager (the time wheel), self-host server primitives, a dashboard server, and 3 Drizzle migrations. This work adds the manifest store + idempotency wiring + the `createNodeStandaloneDriver` factory; it does not duplicate the run-store and wakeup-manager machinery.

### 7.1 What's already there

In `packages/workflows-orchestrator-node/` (existing):

- **`voyant_snapshot_runs`** (`postgres-schema.ts`) — denormalized run snapshots: `id`, `workflow_id`, `status`, `started_at`, `completed_at`, `duration_ms`, `tags`, `result`, `input`, `run_record` (full state JSONB), `entry_file`, `replay_of`. Indexed on `(workflow_id, started_at)` and `(status, started_at)`.
- **`voyant_wakeups`** (`postgres-schema.ts`) — wakeup scheduling with lease-based concurrency: `run_id` (PK), `wake_at`, `lease_owner`, `lease_expires_at`, `updated_at`. Indexed on `wake_at` and `lease_expires_at`.
- **`createPostgresSnapshotRunStore`** — implements the `RunRecordStore` interface against `voyant_snapshot_runs`. Already conforms to the contract Mode 2 needs.
- **`createPersistentWakeupManager`** (`persistent-wakeup-manager.ts`) — the time-wheel equivalent. Polls `voyant_wakeups`, claims due wakeups via lease, drives runs, re-schedules. Handles crash recovery via lease expiration. **Functionally identical to what §7.2 of the previous draft proposed building from scratch.**
- **`runPostgresMigrations`** (`migrate.ts`) — boots the schema; reusable from any consumer.
- **`startNodeSelfHostServer` / `dashboard-server.ts`** — self-host HTTP server with run inspection routes. Already has the read-side primitives the dashboard needs.
- **`buildResumeJournal`, `recordToSnapshot`, etc.** — utilities the driver composes.

The package's data model differs from §7.1 of the previous draft: it stores the full `RunRecord` as `run_record` JSONB on `voyant_snapshot_runs` rather than a separate `workflow_runs` + `workflow_journal_events` split. Wakeups live in their own table with leases (not claim_token-on-the-run-row). Both shapes work; we adopt the existing one because it's already migrated, tested, and used.

### 7.2 What this work adds

Three additive pieces, all inside `packages/workflows-orchestrator-node`:

1. **Idempotency column on `voyant_snapshot_runs`.** New migration `0003_idempotency_key.sql`:

   ```sql
   ALTER TABLE voyant_snapshot_runs ADD COLUMN idempotency_key text;
   CREATE UNIQUE INDEX voyant_snapshot_runs_idempotency_idx
     ON voyant_snapshot_runs (workflow_id, idempotency_key)
     WHERE idempotency_key IS NOT NULL;
   ```

   `createPostgresSnapshotRunStore` extends to read `triggerArgs.idempotencyKey`, populate the column on insert, and use `INSERT … ON CONFLICT DO NOTHING RETURNING id` to dedup. On conflict, the store loads and returns the existing run. This is the engine wiring tracked in §15.2.

2. **Manifest store table.** New migration `0004_manifests.sql`:

   ```sql
   CREATE TABLE voyant_workflow_manifests (
     environment    text NOT NULL,
     version_id     text NOT NULL,
     manifest       jsonb NOT NULL,
     registered_at  timestamptz NOT NULL DEFAULT now(),
     is_current     boolean NOT NULL DEFAULT false,
     PRIMARY KEY (environment, version_id)
   );
   CREATE UNIQUE INDEX voyant_workflow_manifests_current_idx
     ON voyant_workflow_manifests (environment) WHERE is_current;
   ```

   New `createPostgresManifestStore` exports an interface `ManifestStore` (`registerManifest`, `getCurrent`, `pruneToVersions(n)`).

3. **`createNodeStandaloneDriver(opts): DriverFactory`.** New file. Composes:
   - Existing `createPostgresSnapshotRunStore` for state.
   - Existing `createPersistentWakeupManager` for the time wheel.
   - New `createPostgresManifestStore` for manifests.
   - New `event-router.ts` (from `@voyantjs/workflows-orchestrator`) for `where`-predicate matching.
   - In-process step dispatch via `handleStepRequest` from `@voyantjs/workflows/handler`.

   Returns a `DriverFactory` (per §6.3) that `createApp()` invokes once the container is built. The factory closes over its options; the resulting driver gets `services` from the framework deps argument.

### 7.3 Concurrency model

Multiple Node processes can run the same Mode 2 driver against the same Postgres database. The existing **lease mechanism** in `voyant_wakeups` (`lease_owner` + `lease_expires_at` columns) ensures only one process drives a given run at a time. There is no "leader" — every process polls for due wakeups and claims what it can via lease acquisition.

**Trigger contention.** `trigger()` writes a new row; idempotency is enforced via the new `voyant_snapshot_runs_idempotency_idx` unique partial index. A second concurrent `trigger()` with the same `(workflow_id, idempotency_key)` raises a unique-violation; the driver catches it and returns the existing run.

**Resume contention.** A waitpoint injection mutates the `run_record` JSONB; the existing snapshot store handles this with read-modify-write via update guards. Crash mid-update is recoverable because journal events inside the JSONB are append-only and replay-safe.

**Managed Cloud continuation.** Managed Cloud uses the same journal and
waitpoint semantics, but owns the durable run store and dispatches hosted
activations itself. When an activation parks, Cloud persists the returned
`journal` plus each pending waitpoint as a `WorkflowWaitpointSnapshot`: stable
id, stable key, kind, optional event/signal/token name, expiry, timeout, and
framework metadata. A later resume dispatch must resolve one stored waitpoint
into the journal before invoking the runner. The framework helper
`buildResumeStepRequest(...)` in `@voyantjs/workflows/handler` performs that
mutation and attaches `activation.kind = "resume"` metadata with release,
bundle, journal reference, waitpoint, payload reference, and freshness fields.
The runner still receives the normal `WorkflowStepRequest` shape, so it
continues by replaying the workflow body against the prior journal: completed
steps and resolved waitpoints are consumed from the journal, and only new work
after the suspended point executes. Resume is therefore continuation, not a
fresh run or a rerun from scratch.

### 7.4 Step execution

For Mode 2, the driver wires `StepHandler` (`packages/workflows-orchestrator/src/types.ts:149`) directly to `handleStepRequest` from `@voyantjs/workflows/handler` — no HTTP, no dispatch namespace. The workflow body executes in the same process as the driver.

This collapses the `runtime: "edge"` vs `runtime: "node"` distinction inside single-process Mode 2. Both run in the same Node process; the runtime hint is preserved in the journal for observability but doesn't change scheduling. Documented as a Mode 2 caveat.

For Mode 2 operators who want isolation (run heavy steps in a separate process so the request loop isn't blocked), the recommendation is **not** a different runtime; it's a different deployment shape: a sibling Node process with the same DB connection. Same code, dedicated process. §18.1 spells this out.

### 7.5 Crash safety

The existing `@voyantjs/workflows-orchestrator-node` already provides:

- `voyant_snapshot_runs` updates use snapshot store guards; lost writes don't silently overwrite.
- `voyant_wakeups` leases expire on driver crash; another driver claims the wakeup on the next poll.
- Journal events inside `run_record` are append-only and event-id-deduped on insert.
- Resume utilities (`buildResumeJournal`) tolerate partial writes.

The orchestrator core's `driveUntilPaused` already assumes replay-safe semantics — Mode 2 inherits these guarantees from the existing snapshot store + wakeup manager unchanged.

### 7.6 Observability

- `WORKFLOWS_LOG_LEVEL=debug` enables a JSON-line journal log on every drive.
- Counters mirror Mode 1's (§17): `events.received`, `events.matched`, `events.skipped`, `runs.triggered`. They go through the same logger interface that `createApp()` already wires.
- Dashboard works against `driver.admin` (§6.2). Mode 2's admin is implemented against `voyant_snapshot_runs` directly — list, search, filter, all relational queries are free, and the existing `dashboard-server.ts` provides the HTTP surface.

### 7.7 What changed from the previous draft

For reviewers comparing against an earlier version of this doc: the previous draft proposed creating `@voyantjs/workflows-orchestrator-postgres` with `workflow_runs` + `workflow_journal_events` + `workflow_manifests` tables and a SKIP-LOCKED time wheel. **All of that is replaced by extending `@voyantjs/workflows-orchestrator-node`**, which already ships equivalents:

| Previous draft | Existing in `workflows-orchestrator-node` |
|---|---|
| `workflow_runs` table | `voyant_snapshot_runs` |
| `workflow_journal_events` table | (folded into `run_record` JSONB) |
| `claim_token` + `due_at` on the run row | `voyant_wakeups` table with leases |
| New SKIP-LOCKED time wheel | `createPersistentWakeupManager` |
| New `createPostgresSnapshotRunStore` | already exists |
| New 3 migrations | 3 already applied; we add 2 more (idempotency + manifests) |

Net delta: 2 migrations, a manifest store module, and a driver factory that composes existing infrastructure. ~70% smaller than the previous draft.

## 8. Mode 1 — all on Cloudflare

App + tenant + orchestrator + node-step containers, all on Cloudflare. Reuses the existing `workflows-orchestrator-cloudflare` package; this work adds the manifest + event-router layers.

### 8.1 What's already there

The CF orchestrator package (`packages/workflows-orchestrator-cloudflare`) already implements:

- **State store**: DO-per-run via `createDurableObjectRunStore` (`do-store.ts`). One DO instance holds one `RunRecord`.
- **Time wheel**: DO alarms via `handleDurableObjectAlarm` (`durable-object.ts:125-165`).
- **Step dispatch — edge**: CF dispatch namespace via `createDispatchStepHandler` (`dispatch-handler.ts`), targeting a tenant Worker.
- **Step dispatch — node**: CF Containers via `createCfContainerStepRunner` + `apps/workflows-node-step-container`.
- **Public HTTP surface**: `/api/runs`, `/api/runs/:id`, `/api/runs/:id/{cancel,events,signals,tokens}` in `worker.ts`.

Deployable templates exist: `apps/workflows-orchestrator-worker`, `apps/workflows-tenant-worker`, `apps/workflows-selfhost-cloudflare-worker`, `apps/workflows-node-step-container`.

### 8.2 What this work adds

Three new pieces, all in `packages/workflows-orchestrator-cloudflare`:

- **`POST /api/manifests`** — register a manifest for an environment. Stored in CF KV keyed by environment. Last 3 versions retained (LRU, KV list-prefix-based). Used by `driver.registerManifest`.
- **`POST /api/events`** — ingest a single event; load manifest from KV, evaluate `where`, apply `input` mapper, forward each match into the existing `/api/runs` flow with a derived idempotency key. Synchronous response: matches + run ids. Used by `driver.ingestEvent`.
- **`GET /api/manifests/:env`** — read-only inspector. Used by `driver.getManifest`.

The server-side filter matching code is the SAME code Mode 2's in-process driver uses, factored into `packages/workflows-orchestrator/src/event-router.ts`. This is what makes the compliance test suite (§6.4) tractable across modes.

The CF driver factory:

```ts
createCloudflareEdgeDriver({
  orchestratorNamespace: env.WORKFLOW_RUN_DO,    // existing
  manifestKv:            env.WORKFLOW_MANIFESTS, // new binding
  dispatchNamespace:     env.DISPATCHER,          // existing (tenant Workers)
  nodeStepPool:          env.NODE_STEP_POOL,      // existing (CF Containers)
  environment:           "production",
  fetch?:                customFetch,             // optional
})
```

Returns a `WorkflowDriver` whose methods talk to the orchestrator via Worker RPC where possible (DO bindings, KV bindings) and via HTTP only at the boundary between an external app and the orchestrator (when the app is deployed separately from the orchestrator). For the typical Mode 1 deployment where app and orchestrator are bound in the same wrangler config, no HTTP is needed.

### 8.3 Cross-run queries in Mode 1 — the honest limit

Each DO holds one run; listing all runs of a workflow means scanning DOs (expensive at any scale) or maintaining a separate index. The CF orchestrator does neither today — see the comment at `apps/workflows-orchestrator-worker/src/worker.ts:30-32`.

For self-host Mode 1 operators, `driver.admin.listRuns()` is **not implemented**. Three honest paths:

1. **Accept the limit** — the dashboard surfaces "open this specific runId" only. Acceptable for many operators.
2. **Run Mode 2 instead** — keep your app on Workers but run the orchestrator in a sibling Node container with Postgres. Cross-run queries are free.
3. **Stand up your own index** — copy the pattern voyant-cloud uses (a Postgres or D1 read-side fed by a journal event subscriber). Out of scope for the framework; documented as an extension point.

Mode 2 has cross-run queries natively. Voyant Cloud has them via path #3. Mode 1 self-host is the only configuration where this trade-off shows up, and that's an honest reflection of the underlying primitives.

## 9. Voyant Cloud (deployed Mode 1)

Voyant Cloud is **Mode 1 deployed on Voyant infra**, plus four wrapper layers. None of the four layers live in this repo:

1. **Org-scoped request routing.** Incoming requests carry an org/project token; voyant-cloud's edge layer routes to per-tenant orchestrator namespaces.
2. **Cross-run query index.** Postgres or D1 read-side fed by journal subscribers — fills the gap from §8.3.
3. **Multi-tenant scoped tokens.** `events:write`, `manifests:write`, `runs:trigger` per-org keys. Self-host has no equivalent because self-host doesn't have multiple tenants.
4. **Customer dashboard integration.** The dashboard UI bundled into the Voyant Cloud product, talking to the same `WorkflowAdmin` interface (§6.2) the self-host dashboard uses.

What's important is what Voyant Cloud is **not**: it's not a different runtime, not a different driver, not a parallel architecture. It's the same code in this repo, deployed by Voyant, with multi-tenancy and product UI added on top. From the runtime's perspective — and from a workflow author's perspective — there is no difference.

The deployment specifics, multi-tenant logic, billing integration, and dashboard UI live in `/Users/mihai/builds/internal/voyant-all/voyant-cloud`. This repo's design surface stops at the `WorkflowDriver` and `WorkflowAdmin` interfaces.

## 10. Module + plugin declaration surface

### 10.1 Module interface

`packages/core/src/module.ts` `Module` gets two new optional fields. To avoid a `core ↔ workflows` dependency cycle (core can't import `WorkflowDefinition` from `@voyantjs/workflows`, since `@voyantjs/workflows` already imports `Module` and `ModuleContainer` from core), the field types are **structural descriptors defined in core**:

```ts
// packages/core/src/module.ts (new types)

/** Minimum shape of a workflow registration; @voyantjs/workflows's WorkflowDefinition satisfies this structurally. */
export interface WorkflowDescriptor {
  readonly id: string
  // The driver/runtime treats this as opaque — the concrete runtime types live in @voyantjs/workflows
  // and structurally extend this descriptor. Core never inspects beyond `id`.
}

/** Minimum shape of an event-filter runtime entry. */
export interface EventFilterDescriptor {
  readonly id: string                        // payloadHash-derived
  readonly eventType: string                 // matches EventEnvelope.name
  // Same opaque-extension pattern as above.
}

export interface Module {
  // ... existing fields (name, version, dependencies, service, subscribers, etc.)

  /** Workflows owned by this module. Collected at createApp() boot. */
  workflows?: readonly WorkflowDescriptor[]

  /** Event filters owned by this module. Collected at createApp() boot. */
  eventFilters?: readonly EventFilterDescriptor[]
}
```

`@voyantjs/workflows`'s concrete types — `WorkflowDefinition` (`packages/workflows/src/workflow.ts:42`) and `EventFilterRuntimeEntry` (new in PR2) — satisfy these structural descriptors via TypeScript's structural compat without either side importing the other. Core stays workflow-agnostic; workflows stays core-aware (one-way dependency, as today). The framework's manifest-builder casts the collected descriptors back to their concrete types at the workflow-runtime boundary, where the runtime owns both shapes.

This is the same pattern Voyant uses for `LinkableDefinition` (`packages/core/src/links.ts`) — core defines the structural contract, downstream packages provide concrete instances.

A module's source becomes:

```ts
// packages/promotions/src/workflows/bulk-reindex-products.ts
import { workflow } from "@voyantjs/workflows"
import { z } from "zod"

export const BulkReindexInput = z.object({
  sellerOperatorId: z.string(),
  reason: z.object({
    kind: z.enum(["promotion.changed", "scheduler.boundary"]),
    offerId: z.string().optional(),
    source: z.enum(["created", "updated", "deleted", "expired"]).optional(),
  }),
})
export type BulkReindexInput = z.infer<typeof BulkReindexInput>

export const bulkReindexProducts = workflow<BulkReindexInput, void>({
  id: "promotions.bulk-reindex-products",
  defaultRuntime: "node",
  retry: { maxAttempts: 3, backoff: { kind: "exponential", initialMs: 1000 } },
  run: async (input, ctx) => { /* see §20 for the body */ },
})

// packages/promotions/src/event-filters.ts
import { trigger } from "@voyantjs/workflows"
import { bulkReindexProducts } from "./workflows/bulk-reindex-products.js"

export const promotionsEventFilters = [
  trigger.on<PromotionChangedEventData>("promotion.changed", {
    target: bulkReindexProducts,
    where: { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
    input: {
      object: {
        sellerOperatorId: { path: "metadata.tenantId" },
        reason: {
          object: {
            kind: { lit: "promotion.changed" },
            offerId: { path: "data.offerId" },
            source: { path: "data.source" },
          },
        },
      },
    },
  }),
]

// packages/promotions/src/index.ts (the module)
export const promotionsModule: Module = {
  name: "promotions",
  // ...
  workflows: [bulkReindexProducts],
  eventFilters: promotionsEventFilters,
}
```

The path roots `data.*` and `metadata.*` match the `EventEnvelope` shape defined in `packages/core/src/events.ts:40`. See §14.

### 10.2 Plugin interface

`packages/core/src/plugin.ts` `Plugin` gets the same two fields. `definePlugin({ workflows, eventFilters, ... })` parallels the existing `modules`, `extensions`, `subscribers`, `links`. `registerPlugins()` flattens these into the same collection step `createApp()` runs on modules.

This means the SmartBill, Payload-CMS, and Sanity-CMS plugins (`packages/plugins/*`) gain the option to ship workflows. None of them have to today; the migration is a follow-up (§21).

### 10.3 `createApp()` integration

`createApp()` in `@voyantjs/voyant-hono` gains two responsibilities:

1. **Resolve a workflow driver.** `createApp({ workflows: { db } })` (Mode 2 default) or `createApp({ workflows: { driver: ... } })` (explicit). No `workflows` field at all is also valid for templates that don't use workflows — the framework no-ops the boot pipeline below.
2. **Collect, register, and bridge.** After resolving modules + plugins, gather their `workflows` and `eventFilters` arrays, build the manifest, call `driver.registerManifest(manifest)`, and install an EventBus forwarder that routes emitted events to `driver.ingestEvent(...)`.

Manifest registration runs inside the existing lazy `bootstrapPromise` path (`packages/hono/src/app.ts:43`); `createApp()` itself remains synchronous and returns a `Hono<...>`. See §18 for the boot-flow specifics, including the new `app.ready()` accessor that resolves the bootstrap promise for tests.

The EventBus forwarder is a single subscriber installed on every `eventType` that appears in the collected event filters. It is fire-and-forget by design (matching the in-process EventBus's at-most-once contract). For at-least-once delivery, ship the durable-ingest follow-up (§16.2).

### 10.4 Worked module: promotions

After this work lands, the promotions module ships:

- `packages/promotions/src/workflows/bulk-reindex-products.ts` — workflow definition; body uses `ctx.services.resolve(...)` to get the indexer + products repo from the framework's container (see §11).
- `packages/promotions/src/event-filters.ts` — one `trigger.on()` declaration.
- `packages/promotions/src/index.ts` — module wires the above.

The operator template's `catalog-bridge.ts:247-264` and `promotion-scheduled.ts:82-91` warn-blocks delete entirely. Closes #515.

## 11. Workflow context and dependency injection

This section is the load-bearing piece that makes "modules ship workflows" actually work. The current `WorkflowContext` (`packages/workflows/src/workflow.ts:152`) exposes `step`, `sleep`, `waitForEvent`, `waitForSignal`, `invoke`, `parallel`, `stream`, `metadata`, etc., but it has **no service container.** A workflow body that needs `db`, an `IndexerService`, a `ProductsRepository`, or an event bus has to construct them from raw env, which couples every workflow body to deployment details and makes shipping workflows from a module impossible — the module doesn't know which Postgres URL or which R2 bucket the template is using.

The fix threads the framework's existing `ModuleContainer` (`packages/core/src/container.ts:9`) through to the workflow context.

### 11.1 The container today

`createApp()` already builds a `ModuleContainer` and registers each module's `service` under the module's name (`packages/hono/src/app.ts:48-54`). HTTP route handlers resolve services from `c.get("container")`. Modules that need cross-cutting services (a logger, an event bus, a database client) get them this way today.

That same container is the right thing to expose to workflow step bodies. It already encodes the "modules declare what they need" pattern; we just have to plumb it.

### 11.2 The wiring

Three coordinated changes:

1. **Extend `StepHandlerDeps`** (`packages/workflows/src/handler/index.ts:38`) with an optional `services?: ModuleContainer`. When set, every step invocation forwards it into `executeWorkflowStep`.
2. **Extend `CtxBuildArgs`** (`packages/workflows/src/runtime/ctx.ts:127`) with the same `services` field, and surface it on `WorkflowContext` as `services: ModuleContainerView`. The view is read-only — workflows resolve, they don't register.
3. **Wire from `createApp()`**. `createApp()` invokes the configured driver factory
   after it has built the module container, passing a read-only service resolver
   in the factory deps:

   ```ts
   const promotionsWorkflowServices = {
     module: {
       name: BULK_REINDEX_SERVICE_KEY,
       service: bulkReindexProductsService,
     },
   }

   const app = createApp({
     modules: [promotionsHonoModule, promotionsWorkflowServices],
     workflows: {
       driver: () => createNodeStandaloneDriver({ db }),
     },
   })
   ```

   The Node factory closes over `db`; `createApp()` supplies `{ services }`
   when it constructs the driver. No underscore-prefixed methods, no setter API
   on the driver — the factory takes framework services at construction time.

   Existing entry-file self-host deployments that use
   `startNodeSelfHostServer()` directly can pass the same read-only resolver via
   `services`; new package workflow integrations should prefer the `createApp()`
   composition path.

The container reaches the workflow body through the same path the rest of `StepHandlerDeps` does: orchestrator → step handler → executor → ctx → workflow `run`. No new transport.

### 11.3 What `ctx.services` exposes

```ts
export interface ModuleContainerView {
  /** Resolve a service registered under `name`. Throws if not registered. */
  resolve<T>(name: string): T

  /** Check if a service is registered. Useful for optional dependencies. */
  has(name: string): boolean
}
```

This is `ModuleContainer` minus `register`. Step bodies can read; they cannot mutate the container at runtime.

Typed resolution: modules export a typed accessor alongside the registration so consumers don't pass strings around:

```ts
// packages/promotions/src/services.ts
import type { ModuleContainerView } from "@voyantjs/core"
import type { IndexerService } from "@voyantjs/catalog"
import type { ProductsRepository } from "@voyantjs/products"

export const promotionsServices = {
  indexer: (c: ModuleContainerView): IndexerService => c.resolve("indexer"),
  productsRepo: (c: ModuleContainerView): ProductsRepository => c.resolve("products"),
}
```

Workflow body becomes:

```ts
run: async (input, ctx) => {
  const indexer = promotionsServices.indexer(ctx.services)
  const repo = promotionsServices.productsRepo(ctx.services)
  // ...
}
```

This is convention, not enforcement. The framework doesn't care which keys you use — typed accessors are just the recommended pattern, and modules document their key in their README.

### 11.4 What gets registered by default

`createApp()` registers a small set of framework-owned services so workflows that need infrastructure don't have to know which template they're in:

| Key | Value | Notes |
|---|---|---|
| `db` | The shared database client (`NeonDatabase` or compat) | Same instance routes use. |
| `eventBus` | The framework's `EventBus` | Workflows can `emit` events; subscribers (and other workflow filters) react. |
| `logger` | The framework logger | Per-call binding. |
| `now` | `() => number` | Injectable clock. |
| Module names | Module's `service` value | Whatever each module registered (existing behavior). |

Templates or plugins can publish additional keys by registering a host-owned
module `service` under the key workflows resolve, or by registering into the
same container during bootstrap when the workflow cannot run before that
bootstrap completes. This is where catalog services like `indexer` and
`productDocBuilder` come from in an app template.

### 11.5 Step-level vs ctx-level access

`ctx.services` is available throughout the workflow body. Step bodies (`ctx.step("name", async (s) => ...)`) receive a `StepContext` (`s`) for step-local concerns (`signal`, `attempt`, `log`); they share the parent ctx's `services` via closure. There's no separate per-step container — the same one works inside and outside steps.

### 11.6 What this enables

Concrete patterns the gap blocks today:

- **Modules ship workflow bodies that read shared services.** `bulkReindexProducts` uses `ctx.services.resolve("indexer")` instead of constructing one. Move the workflow between templates → it still works, as long as the host template registers an `indexer`.
- **Plugins inject services for module workflows.** A `@voyantjs/plugin-typesense` could register `indexer` against a Typesense client; a `@voyantjs/plugin-meilisearch` could register the same key against Meilisearch. Module workflows are unchanged.
- **Tests inject mocks.** `createInMemoryDriver({ services: testContainer })` for isolated workflow body tests; `createNodeStandaloneDriver({ db: testDb })(testFactoryDeps({ services: testContainer }))` for integration tests.

### 11.7 What it does NOT do

- **Not a DI framework.** No scoping, no factories, no lifecycle hooks. The `ModuleContainer` is a Map. Templates that want richer DI wrap or replace it (per `packages/core/src/container.ts:5`).
- **Not lazy.** Services are registered at boot; resolution is synchronous. A workflow body that calls `ctx.services.resolve("missing")` throws synchronously and that exception fails the step.
- **Not type-safe end-to-end.** TypeScript can't verify that `resolve("indexer")` returns the same type the registrar passed. The typed-accessor pattern (§11.3) is the recommended workaround. A future revision could add registration-side type tags; out of scope for v1.

## 12. The `trigger.on()` runtime

`trigger.on()` becomes a runtime collector. Replace the throwing proxy in `packages/workflows/src/trigger.ts:131` with:

```ts
export const trigger: TriggerApi = {
  on<T>(event: string, filter: EventFilterDeclaration<T>): EventFilterRuntimeEntry {
    return compileEventFilter(event, filter)  // throws on shape errors
  },
}
```

`compileEventFilter` runs the registration-time linter (path roots, type sanity, schema sanity), computes `payloadHash`, and returns an `EventFilterRuntimeEntry` containing both the serializable `EventFilterManifestEntry` and a debug-only structural copy of the original declaration. Modules collect these into arrays and export them.

The existing `EventFilterDeclaration<T>` shape changes:

```ts
// Before (never had a runtime)
export interface EventFilterDeclaration<T> {
  target: WorkflowHandle<T, unknown>
  match?: (payload: T, ctx: { ... }) => boolean
  scope?: string
  input?: (payload: T) => unknown
}

// After
export interface EventFilterDeclaration<T> {
  target: WorkflowDefinition<T, unknown>
  where?: PredicateExpr
  input?: InputMapper
}
```

Dropped:

- `match` callback. Was never invoked at runtime; replaced by `where`. Registration-time error redirects users to the new field.
- `input` callback. Replaced by structured mapper.
- `scope`. The current `EventEnvelope` (`packages/core/src/events.ts:40`) has no top-level scope field; if a caller wants scoped routing they put a marker in `metadata.scope` and reference it from `where`. The filter-level `scope` field would have been redundant with the predicate.

`EventFilterManifestEntry` (`packages/workflows/src/protocol/index.ts:85`) gains `where` and `input` fields and drops `matchExpression` (which was never specified). `WorkflowManifest.schemaVersion` stays `1` because no orchestrator has ever consumed the previous shape.

## 13. Predicate + input-mapper DSLs

These two DSLs are small on purpose. Both modes must implement them identically — and they do, because both modes call into the same `event-router.ts` code.

### 13.1 `PredicateExpr`

```ts
type PathOrLit =
  | { path: string }                    // dot-path into the event envelope
  | { lit: string | number | boolean | null }

type PredicateExpr =
  | { eq:    [PathOrLit, PathOrLit] }
  | { neq:   [PathOrLit, PathOrLit] }
  | { in:    [PathOrLit, PathOrLit[]] } // membership
  | { gt:    [PathOrLit, PathOrLit] }
  | { gte:   [PathOrLit, PathOrLit] }
  | { lt:    [PathOrLit, PathOrLit] }
  | { lte:   [PathOrLit, PathOrLit] }
  | { exists: PathOrLit }                // path resolves to non-undefined
  | { not:    PredicateExpr }
  | { and:    PredicateExpr[] }
  | { or:     PredicateExpr[] }
```

**Path syntax.** Dot-separated, `[N]` for array index. Missing intermediate keys produce `undefined`, which makes `eq` false (not throw) but `exists` false. Numeric paths are not coerced; `eq` between string `"1"` and number `1` is false.

**Roots.** Paths address into the standard `EventEnvelope` (`packages/core/src/events.ts:40`):

| Root | Resolves to | Example |
|---|---|---|
| `data.*` | The business payload | `data.affected.kind`, `data.offerId` |
| `metadata.*` | The metadata envelope | `metadata.tenantId`, `metadata.actorId`, `metadata.eventId` |
| `name` | The event name string | `name` (no further sub-path; it's a scalar) |
| `emittedAt` | ISO timestamp string | `emittedAt` |

Anything else is a registration error. The CLI/test harness statically rejects invalid roots when building the manifest.

**Type sanity.** `gt`/`gte`/`lt`/`lte` require both sides number or both string; mixed → registration error. Booleans and null only support `eq`/`neq`/`exists`. Runtime type mismatches return `false` (not throw); registration-time linting catches the common mistakes.

The 12 operators are a closed set. If a real consumer surfaces a need they don't cover, we add to the union — it's a code change in `predicate.ts`, not a runtime extension. The escape hatch is to omit `where` (always-fire) and do the conditional inside the workflow body.

### 13.2 `InputMapper`

```ts
type InputMapper =
  | undefined                                       // pass-through: workflow input = event envelope's data
  | { passthrough: true }                           // explicit pass-through
  | { path: string }                                // workflow input = the resolved value at this path
  | { object: Record<string, InputMapper | PathOrLit> }  // build an object; nested object is also allowed
```

Pass-through default returns `envelope.data` as the workflow input. Explicit `{ path }` lets workflows whose input is a string take just that path. The `object` form covers ~all real cases.

If the workflow declares a Zod input schema, the manifest builder validates a representative shape produced by the mapper at registration time. Catches *"forgot to project a required field"* at deploy.

### 13.3 `payloadHash`

SHA-256 of the canonicalized filter declaration `(eventType, where, input, targetWorkflowId)`. Canonicalization recursively alphabetizes object keys before hashing. Stable across re-deploys. Used as the filter's identity in dedup logic.

## 14. Manifest lifecycle

### 14.1 Boot

The bootstrap phase inside `createApp()` builds the manifest from collected modules + plugins and calls `driver.registerManifest(manifest)` once at startup, behind a `Promise<void>` cache (the existing `bootstrapPromise`) so multiple isolates / processes don't race.

```ts
// inside the bootstrap path
const manifest = buildManifest({
  environment: opts.environment,
  workflows: collectWorkflows(modules, plugins),
  eventFilters: collectEventFilters(modules, plugins),
})
await driver.registerManifest({ environment: manifest.environment, manifest })
```

Build determinism: `buildManifest` produces the same `WorkflowManifest` (same `versionId`, byte-identical) for the same module/plugin set. `versionId` is `sha256(canonical(manifest)).slice(0, 16)`. So two processes that boot the same code register the same version; the second process's call is a no-op.

### 14.2 Versioning

- **Mode 2**: `voyant_workflow_manifests` table (new in §7.2) keeps the latest 3 versions per environment. The `is_current` boolean is flipped under a transaction — atomic.
- **Mode 1**: KV-backed; last 3 versions retained via list-prefix delete. KV's eventual consistency means a freshly-pushed manifest can take O(60s) to propagate globally, which is fine for manifest reads (manifests change at deploy, not per-event).

### 14.3 Mismatch detection

When a process boots with manifest `vN`, the driver fetches the current manifest, compares versionIds. If the stored version is newer (rolling deploy), the boot is a no-op. If the booting process's manifest is newer, it pushes. If equal, no-op. Converges across instances without coordination.

## 15. Event ingest semantics

### 15.1 Endpoint contract

`driver.ingestEvent(...)` is **synchronous** from the caller's POV (`await driver.ingestEvent(...)` returns when matches are decided and runs are queued). One event per call; batching is the caller's responsibility.

The argument is the standard `EventEnvelope` shape, augmented with the environment routing field:

```ts
export interface IngestEventArgs {
  environment: EnvironmentName
  envelope: EventEnvelope                 // { name, data, metadata, emittedAt }
  /** Optional caller-supplied idempotency override. */
  idempotencyKey?: string
}
```

The framework-installed forwarder (§18) wraps `eventBus.emit(...)` and produces the `IngestEventArgs` from the bus envelope, stamping `metadata.eventId` if absent (§15.2).

### 15.2 Idempotency

Run dedup uses the existing `idempotencyKey` mechanism on `trigger()`. The driver derives a key per match:

```
deriveIdempotencyKey(envelope, filterId) = `${filterId}:${eventId(envelope)}`

eventId(envelope) =
  envelope.metadata?.eventId
  ?? `${envelope.name}:${envelope.emittedAt}:${sha256(canonical(envelope.data)).slice(0, 12)}`
```

The framework-installed EventBus forwarder always stamps `metadata.eventId` with a freshly-generated ULID before calling `driver.ingestEvent(...)`, so framework-internal events have a stable id even though the core `EventEnvelope` doesn't carry one. External callers (storefront BFF, webhooks, ops scripts) MAY supply their own `metadata.eventId`; if they don't, the fallback derivation gives a best-effort key based on `(name, emittedAt, hash(data))`. The fallback is "best-effort" because two distinct events emitted in the same millisecond with identical payloads collapse to one — a corner case acceptable in v1, eliminated by always supplying an explicit id.

A caller-supplied `args.idempotencyKey` overrides the derivation entirely, and is used as `${filterId}:${suppliedKey}` to keep per-filter independence.

**Note on prerequisite engine wiring.** `TriggerOptions.idempotencyKey` is currently declared on the SDK side (`packages/workflows/src/trigger.ts:30`) but the orchestrator core's `TriggerArgs` (`packages/workflows-orchestrator/src/orchestrator.ts:22-52`) doesn't carry it and nothing dedups. The audit in §23's PR1 plan accordingly includes wiring this end-to-end:

- **Mode 2** enforces via the `workflow_runs_idempotency_idx` unique partial index in §7.1's schema (`INSERT … ON CONFLICT DO NOTHING RETURNING id` → return existing run on conflict).
- **Mode 1** enforces via deterministic `runId` derivation from the idempotency key, so the same key always maps to the same DO instance (existing `idFromName` in `worker.ts:165`).

Without this enforcement the ingest dedup story is best-effort and the duplicate-event-suppression claim above is false. PR1 includes the wiring + a compliance test (`"trigger with idempotencyKey deduplicates"`).

### 15.3 Ordering, backpressure, size

No ordering guarantee. Two events emitted in sequence may produce runs that start in either order. Workflows that need ordering encode it via input (sequence number) and reconcile inside the body. Consistent with `event-delivery-and-durable-execution-policy.md` §3.

Backpressure: synchronous calls block in-process; for the optional HTTP ingest adapter, the orchestrator returns 503 under load. v1 does not retry on backpressure — events are dropped + counted.

Size: hard cap 256 KiB per event payload; over → 413 (HTTP) or `EventTooLargeError` (in-process).

### 15.4 The optional HTTP ingest adapter

By default Mode 2 has no HTTP boundary at all — `driver.ingestEvent(...)` is an in-process function call from the EventBus forwarder. When external emitters need to fire events into the runtime (a storefront BFF on a different host, a third-party webhook, a sibling process on a different machine), the operator mounts the **HTTP ingest adapter**:

```ts
import { mountHttpIngestAdapter } from "@voyantjs/workflows/http-ingest"

const app = createApp({ /* ... */ workflows: { db } })

mountHttpIngestAdapter(app, {
  driver: app.workflows.driver,
  basePath: "/api/workflows",            // optional; default /api/workflows
  verifyRequest: createBearerVerifier([env.WORKFLOWS_INGEST_TOKEN]),
})
```

This mounts `POST /api/workflows/events`, `POST /api/workflows/manifests`, and `GET /api/workflows/manifests/:env` — the same routes Mode 1's CF orchestrator exposes under `/api/events` and `/api/manifests`. The adapter is shared code; both deployments use it.

Self-host operators who don't have external emitters never mount the adapter. Voyant Cloud always mounts it (it's the boundary between a customer's app and Voyant-hosted orchestrators).

### 15.5 Failure modes

| Failure | Behavior |
|---|---|
| Manifest not registered | `ingestEvent` returns `{ ok: false, reason: "manifest_not_registered" }`. Caller logs + drops. |
| `where` predicate throws | Filter skipped; metric `events.skipped{reason="where_eval_error"}`. Other filters proceed. |
| `input` mapper produces undefined for required field | Filter skipped; metric `events.skipped{reason="input_projection_error"}`. |
| Run trigger fails (DB / DO down) | Per-match `status: "error"` in response. `ok: true` if at least one match succeeded; `ok: false` otherwise. |
| Event > 256 KiB | Reject with `EventTooLargeError`. |

### 15.6 Security

Predicate evaluator does not call `eval`, `Function`, `setTimeout(string)`. Path resolver is a string-typed walk. Literal coercion is structural. The DSL grammar is closed and exhaustively typed. Extensions are code changes, not config changes.

## 16. EventBus repositioning

`event-delivery-and-durable-execution-policy.md` already says (§3) *"treat the current event bus as in-process fire-and-forget delivery"* and (§6) *"use durable jobs or workflows for retryable background execution."* This work makes the second part actionable. Once a real workflow runtime exists, the policy's recommendation matches reality.

A small follow-up amends the policy doc:

- `eventBus.subscribe()` is the **observer** primitive: ephemeral side-effects, no retry, no durability. Examples: cache invalidation, log emission, dashboard pings.
- `trigger.on()` is the **default** primitive for retryable / durable / unbounded work: catalog reindex, document generation, channel push, CMS sync.
- Inline subscribers that do "real work" become a code-review red flag.

The amendment is not part of this branch; it's a documentation follow-up tracked separately.

### 16.1 Migration of existing subscribers

Catalogued in §21.

### 16.2 Path to durable ingest (deferred)

The §2 goal 6 commitment is "durable run execution; non-durable event delivery in v1." When durable at-least-once delivery becomes load-bearing (channel push and notifications-out are the likely first cases), the upgrade is:

1. Operator-side: subscribers write to an outbox table (`outbox_events` with `status pending|sent|dead`) instead of calling `driver.ingestEvent(...)`.
2. A drain (cron or DO alarm) selects pending rows and calls `driver.ingestEvent(...)`, marking sent / backing off / dead-lettering. Idempotency at the driver protects against double delivery on retry.
3. Driver-side unchanged. The `metadata.eventId` ULID stamped by the outbox is what makes step 2 idempotent.

Designed-for, not built. The §10.3 / §18 EventBus forwarder's interface is the only thing that changes — its body becomes `outbox.write(...)` instead of `driver.ingestEvent(...)`. The outbox + drain are an additive package (`@voyantjs/workflows-outbox`); no driver changes; no manifest changes.

## 17. Auth, telemetry, failure modes

### 17.1 Auth

Mode 2 has no auth boundary by default — the runtime is in-process. The optional HTTP ingest adapter (§15.4) reuses `createBearerVerifier(tokens)` already wired into `apps/workflows-orchestrator-worker:60-69`.

Mode 1's existing auth on `/api/runs` extends transparently to the new `/api/manifests` and `/api/events` routes (same `createBearerVerifier` pipeline).

Future split (deferred): scoped tokens — `events:write`, `manifests:write`, `runs:trigger`. Voyant Cloud uses these for multi-tenant isolation; self-host doesn't need them.

### 17.2 Telemetry

Both modes expose the same counters. Names + labels:

- `workflows.events.received{environment,eventName}`
- `workflows.events.matched{filterId,targetWorkflowId}`
- `workflows.events.skipped{filterId,reason}`
- `workflows.events.rejected{reason}`
- `workflows.runs.triggered{targetWorkflowId,status}`

Mode 2: counters go through the logger interface `createApp()` already wires. Optional Postgres-backed counter table for persistence — out of scope for v1.

Mode 1: counters land in CF Analytics Engine when bound; locally they're `logger.info(...)` calls.

`WORKFLOWS_LOG_LEVEL=debug` enables a JSON-line journal log of every drive step.

## 18. Boot flow in `createApp()`

`createApp()` is and remains synchronous (`packages/hono/src/app.ts:32`) — it returns a `Hono<...>` and bootstraps lazily on the first request that reads the bootstrap promise. The workflow runtime hooks into that existing lazy path; no signature change, no breaking async factory.

```ts
import { createApp } from "@voyantjs/voyant-hono"

// Mode 2 default — most users
const app = createApp({
  modules: [promotionsModule, bookingsModule /* ... */],
  plugins: [smartBillPlugin({ /* ... */ })],
  workflows: { db },                               // implicit createNodeStandaloneDriver
})

// Tests can opt to wait for boot to complete:
await app.ready()
```

```ts
// Mode 1 — explicit factory (DriverFactory; createApp() invokes it after container assembly)
import { createCloudflareEdgeDriver } from "@voyantjs/workflows/driver-cloudflare-edge"

const app = createApp({
  modules: [/* ... */],
  workflows: {
    driver: createCloudflareEdgeDriver({
      orchestratorNamespace: env.WORKFLOW_RUN_DO,
      manifestKv:            env.WORKFLOW_MANIFESTS,
      dispatchNamespace:     env.DISPATCHER,
      nodeStepPool:          env.NODE_STEP_POOL,
      environment:           "production",
    }),
  },
})
```

What `createApp()` does at construction time (synchronous):

1. Resolves modules + plugins (existing pipeline).
2. Builds the `ModuleContainer` and registers each module's `service` plus the framework-owned defaults (`db` — see lifecycle note below — `eventBus`, `logger`, `now`; see §11.4).
3. Invokes `workflows.driver(bindings)` to obtain a `DriverFactory`, then invokes that factory with `{ services: container, logger, now? }` and stores the resulting `WorkflowDriver`. For Node self-host apps this is typically `driver: () => createNodeStandaloneDriver({ db })`; the framework-supplied services arrive through the factory deps, not the `createNodeStandaloneDriver()` options.
4. Calls `collectWorkflows(modules, plugins)` and `collectEventFilters(modules, plugins)`.
5. Mounts HTTP routes (existing pipeline).
6. Sets up the lazy `bootstrapPromise` to fire on first request.

What runs inside the `bootstrapPromise` (deferred, async):

7. Builds the manifest and calls `driver.registerManifest(...)`.
8. Subscribes a forwarder on the EventBus for each unique `eventType` in the manifest. The forwarder converts the bus envelope into `IngestEventArgs`, stamps `metadata.eventId` with a ULID, and calls `driver.ingestEvent(...)`. Fire-and-forget per §15.3.
9. (Mode 2 only) Starts the time wheel — the existing `createPersistentWakeupManager` from `@voyantjs/workflows-orchestrator-node`.
10. Wires `app.shutdown = async () => { await driver.shutdown?.() }` so SIGTERM stops the wheel cleanly.

**Fail-closed boot semantics.** If `workflows: ...` is configured and any of steps 7-9 throws, the `bootstrapPromise` rejects and the app is unhealthy until restarted. Manifest registration failures are NOT isolated like module-bootstrap failures (which are best-effort logged) — when workflows are configured, registration is part of the contract, and silently skipping it would leave the runtime in a state where some events fire workflows and others vanish. The framework surfaces the rejection through the request handler so the next request sees a 503 with the registration error in the response body.

**The new `app.ready()` accessor** returns the `bootstrapPromise`, **creating it eagerly if it hasn't fired yet**. Tests that need a registered manifest before posting events call `await app.ready()`. Production code that handles HTTP requests never has to call it — the first request triggers the same boot. Headless deployments (next paragraph) MUST call it explicitly.

**Workflows DB lifecycle — separate from per-request DB.** The `workflows.db` connection is **long-lived** and may host `LISTEN/NOTIFY` for low-latency wakeup notification. It is NOT the same lifecycle as the per-request DB the operator's HTTP routes use today (e.g., `withDbFromEnv` patterns that open and close a Pool per Worker invocation). Two valid shapes for `workflows.db`:

- A connection string: `workflows: { db: process.env.DATABASE_URL }` — the framework constructs a long-lived Pool internally.
- A pre-built Pool: `workflows: { db: pool }` — caller owns the Pool's lifecycle.

Do NOT pass a per-request DbFactory or an ephemeral connection that closes after a request. The time wheel needs the connection to stay open between ticks; a closed-after-request connection breaks `LISTEN/NOTIFY` and forces the time wheel into pure polling, which negates the latency benefit.

### 18.1 Sibling-process deployment (Mode 2)

For Mode 2 operators who want isolation between request handling and workflow execution, run `createApp()` in two processes that share Postgres:

- **Process A — HTTP server.** `workflows: { db, disableTimeWheel: true }`. Handles requests, calls `driver.trigger()` and `driver.ingestEvent()`. Does not drive runs forward.
- **Process B — headless workflow runner.** `workflows: { db, onlyTimeWheel: true }`. Drives runs forward via the time wheel. Does NOT serve HTTP. Because there's no first-request to trigger the lazy bootstrap, **Process B MUST call `await app.ready()` explicitly at startup** — otherwise its bootstrapPromise never fires and the time wheel never starts.

Both share the same Postgres. The lease mechanism in `voyant_wakeups` handles concurrent drives across processes (only one process holds a lease for a given run at a time). Documented in the Mode 2 README as the recommended sibling-process pattern.

## 19. Worked example: `bulkReindexProducts`

The workflow this design unblocks. Lives in `packages/promotions/src/workflows/bulk-reindex-products.ts`:

```ts
import { workflow } from "@voyantjs/workflows"
import { z } from "zod"

import { promotionsServices } from "../services.js"

export const BulkReindexInput = z.object({
  sellerOperatorId: z.string(),
  reason: z.object({
    kind: z.enum(["promotion.changed", "scheduler.boundary"]),
    offerId: z.string().optional(),
    source: z.enum(["created", "updated", "deleted", "expired"]).optional(),
  }),
})
export type BulkReindexInput = z.infer<typeof BulkReindexInput>

export const bulkReindexProducts = workflow<BulkReindexInput, void>({
  id: "promotions.bulk-reindex-products",
  defaultRuntime: "node",
  retry: { maxAttempts: 3, backoff: { kind: "exponential", initialMs: 1000 } },
  timeout: "30m",

  run: async (input, ctx) => {
    const indexer    = promotionsServices.indexer(ctx.services)
    const repo       = promotionsServices.productsRepo(ctx.services)
    const docBuilder = promotionsServices.productDocBuilder(ctx.services)

    // Step 1 — paginate the seller's product set into a flat id list.
    const ids = await ctx.step("scan-owned-products", async (s) => {
      const acc: string[] = []
      let cursor: string | undefined
      do {
        s.log("info", "scanning page", { cursor, accumulated: acc.length })
        const page = await repo.list({
          where: { sellerOperatorId: input.sellerOperatorId },
          cursor,
          limit: 500,
        })
        for (const p of page.items) acc.push(p.id)
        cursor = page.nextCursor
        await ctx.metadata.set("scanned", acc.length)
      } while (cursor)
      return acc
    })

    // Step 2 — reindex in batches. Each batch is a separate step boundary so
    // a transient failure mid-reindex retries only the failing batch.
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50)
      await ctx.step(`reindex-batch-${i}`, { runtime: "node" }, async () => {
        await Promise.all(batch.map((id) => indexer.reindexEntity("products", id, docBuilder)))
        await ctx.metadata.set("reindexed", Math.min(i + 50, ids.length))
      })
    }
  },
})
```

The workflow uses the existing SDK (`workflow({ id, run })`, `ctx.step`, `ctx.metadata`) — this work doesn't introduce a new authoring API. The only new thing the body relies on is `ctx.services`, the container access added in §11.

The filter declaration in `packages/promotions/src/event-filters.ts`:

```ts
import { trigger } from "@voyantjs/workflows"
import { bulkReindexProducts } from "./workflows/bulk-reindex-products.js"

export const promotionsEventFilters = [
  trigger.on("promotion.changed", {
    target: bulkReindexProducts,
    where: { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
    input: {
      object: {
        sellerOperatorId: { path: "metadata.tenantId" },
        reason: {
          object: {
            kind: { lit: "promotion.changed" },
            offerId: { path: "data.offerId" },
            source: { path: "data.source" },
          },
        },
      },
    },
  }),
]
```

The promotions module wires both:

```ts
// packages/promotions/src/index.ts
export const promotionsModule: Module = {
  name: "promotions",
  // ...
  workflows: [bulkReindexProducts],
  eventFilters: promotionsEventFilters,
}
```

Once `createApp({ modules: [promotionsModule, ...], workflows: { db } })` is wired, the affected-all reindex Just Works. No template-level glue. The two `console.warn` blocks in the operator template delete entirely.

## 20. Migration of existing inline subscribers

This work enables migration; it does not perform it. Each candidate gets a follow-up issue and a separate PR. Listed here for completeness so the design accommodates them.

| Subscriber | Location | Recommended migration | Priority |
|---|---|---|---|
| `affected.kind === "all"` reindex | `templates/operator/src/api/catalog-bridge.ts:247-264`, `promotion-scheduled.ts:82-91` | Move to `bulkReindexProducts` workflow + `trigger.on("promotion.changed", ...)`. | Closes #515 (this work) |
| Snapshot capture | `catalog-bridge.ts:289-325` | Move to a `captureBookingSnapshot` workflow + `trigger.on("booking.confirmed", ...)`. Adds retry on transient DB errors. | Follow-up issue |
| Per-product reindex (product / availability / pricing) | `catalog-bridge.ts:156-229` | Bounded; fine inline today. Move when execution time becomes a concern. | Follow-up issue |
| Promotion redemption recorder | `catalog-bridge.ts:272-287` | Move to a `recordPromotionRedemptions` workflow for retry semantics. | Follow-up issue |
| CMS sync subscribers | `packages/plugins/{payload-cms,sanity-cms}/src/index.ts` | Move to per-event workflows for retry on CMS API outages. | Follow-up issue |
| SmartBill sync subscribers | `packages/plugins/smartbill/src/index.ts` | Move to per-event workflows for retry on SmartBill API outages. | Follow-up issue |
| Channel push (when built) | `docs/architecture/channel-push-architecture.md` | Ship as workflow from day one. | New work |

Each follow-up is a self-contained PR: add a workflow body, add a `trigger.on()` declaration, delete the inline subscriber. Filed as separate issues; this branch does not consume any.

## 21. Resolved decisions

### 21.1 Self-host first; managed deployment is a wrapper

Rejected: design the runtime cloud-first with multi-tenant primitives baked in (projectId everywhere, HTTP boundaries by default, scoped tokens always). Pushes complexity onto self-host operators; couples the runtime to a deployment shape we don't control.

Accepted: the runtime is single-tenant and in-process by default. `createApp({ workflows: { db } })` is enough. Multi-tenancy, scoped tokens, customer dashboards live in voyant-cloud as wrapper layers around the same runtime.

### 21.2 Workflow runtime is first-class, not pluggable

Rejected: keep `@voyantjs/workflows` as one orchestration option among several. Already rejected by removing Hatchet / Trigger.dev. Re-affirmed.

### 21.3 Server-side filter matching, structured DSL

Rejected: collapse `trigger.on()` to sugar over `eventBus.subscribe(...)` and have emitters POST directly to `/api/runs`. Makes filter declarations behavior, not data; can't accept events from non-app emitters; locks `match`/`input` into whichever runtime is loaded.

Accepted: filter matching at the driver boundary, structured DSL, manifest-backed. Both modes do the same matching against the same manifest format using the same `event-router.ts`.

### 21.4 Drop the `match` callback

Rejected: keep both `match` callback (for ergonomic JS) and `where` (for serialization). Tempts users into JS that can't ship across the wire. Dropping `match` (with a registration-time error redirecting to `where`) keeps the surface honest.

### 21.5 Two reference deployment shapes; D1 deferred

Rejected: ship a D1-backed Mode 1 variant alongside DO+KV; ship a SQLite Mode 2 variant alongside Postgres. Doubles the test matrix in v1.

Accepted: Mode 1 uses DO storage + KV. Mode 2 uses Postgres. Both pass the same compliance suite. D1 is a credible future variant if a real consumer surfaces a need; until then, skip.

### 21.6 Explicit driver at `createApp()` call site

Rejected: env-var-based driver selection (`WORKFLOWS_DRIVER=mode1|mode2`). Configuration-via-env obscures runtime contracts.

Accepted: `createApp({ workflows: { db } })` for Mode 2 default, `createApp({ workflows: { driver: createCloudflareEdgeDriver({...}) } })` for Mode 1. Misconfiguration throws on startup.

### 21.7 Mode 2 reuses snapshot-store update guards for resume contention

Earlier drafts proposed a `version` column on a custom `workflow_runs` table for optimistic concurrency. With §21.17's decision to extend `@voyantjs/workflows-orchestrator-node`, this becomes moot: the existing `createPostgresSnapshotRunStore` already implements update guards via read-modify-write, and the existing `voyant_wakeups` lease mechanism handles cross-process drive contention. No new column needed.

### 21.8 Three orchestrator endpoints, not one

Rejected: combine manifest registration into event ingest. Bundles two concerns; prevents read-only inspection.

Accepted: `/api/manifests`, `/api/events`, `GET /api/manifests/:env`. Three endpoints, three responsibilities. Mode 1 mounts them in the CF orchestrator. Mode 2 mounts them via the optional HTTP ingest adapter when external emitters need them.

### 21.9 Synchronous `/api/events`

Rejected: async ingest + queue. Needs an outbox we don't have. Synchronous ingest is more testable.

Accepted: synchronous, one event per request. Durable async ingest is an additive endpoint when load demands it (§16.2).

### 21.10 No environment isolation cross-talk

Production manifests don't see preview events, and vice versa. Manifest store keys include environment. Event payloads include environment. Driver validates that the event environment matches the resolved manifest. No flag to override.

### 21.11 `createApp()` stays synchronous

Rejected: change `createApp()` to async. Breaks every existing template + adapter; bigger blast radius than the use-case warrants.

Accepted: keep `createApp()` synchronous; reuse the existing lazy `bootstrapPromise` for manifest registration; expose `app.ready()` for tests.

### 21.12 `WorkflowDriver` is execution-only; admin is a separate optional interface

Rejected: include `listRuns`, `getRun`, `cancelRun`, `streamRun` in `WorkflowDriver`. Bloats the contract every driver must satisfy; pushes test-only drivers to implement methods they don't need.

Accepted: five-method `WorkflowDriver` is mandatory; `WorkflowAdmin` is a separate optional interface, exposed via `driver.admin`.

### 21.13 Container threads through driver factory args, not a setter

Rejected: an underscore-prefixed `driver._configureStepHandler({ services })` setter on `WorkflowDriver`. Mixes lifecycle concerns into the execution contract.

Accepted: driver factories take `services?: ModuleContainer` as a constructor arg. `createApp()` passes the container at factory time. `WorkflowDriver` interface stays clean.

### 21.14 Event envelope path roots match `EventEnvelope`

The predicate / mapper DSL roots are `data.*`, `metadata.*`, `name`, `emittedAt` — the actual fields on `packages/core/src/events.ts:40`. No `payload.*` root; no top-level `event.type`. Filters that need scoped routing reference `metadata.scope` (callers populate metadata) instead of a top-level `scope` field.

### 21.15 EventId derivation falls back to a content hash

The core `EventEnvelope` has no `eventId`. The framework-installed forwarder always stamps `metadata.eventId` with a fresh ULID, so framework-internal events have a stable id. External callers can supply their own; the fallback is `${name}:${emittedAt}:${sha256(canonical(data)).slice(0,12)}`, with the documented limitation that two events emitted in the same millisecond with identical payloads collapse to one.

### 21.16 Cross-run queries in self-host Mode 1 are explicitly out of scope

The DO-per-run model has no native cross-run query layer. Adding one in this work would conflate runtime concerns with read-side concerns. Self-host Mode 1 operators who want a dashboard either accept the limit, switch to Mode 2, or stand up their own index. Voyant Cloud handles it in its repo. The runtime is not in the dashboard-index business.

### 21.17 Mode 2 extends `@voyantjs/workflows-orchestrator-node`, not a new package

Rejected: ship a parallel `@voyantjs/workflows-orchestrator-postgres` package with its own schema, run store, and time wheel.

Accepted: extend the existing `@voyantjs/workflows-orchestrator-node` package. It already provides `voyant_snapshot_runs`, `voyant_wakeups`, `createPostgresSnapshotRunStore`, `createPersistentWakeupManager`, `runPostgresMigrations`, and self-host server primitives. This work adds two migrations (idempotency column + manifest table) and the `createNodeStandaloneDriver` factory; everything else composes the existing infrastructure. Smaller delta, no parallel data model, no test-matrix duplication.

### 21.18 Single-tenant runtime keeps the tenant-shaped protocol with default values

`RunRecord.tenantMeta` (`packages/workflows-orchestrator/src/types.ts:111-125`) and `WorkflowStepRequest.tenantMeta` require `tenantId`, `projectId`, `organizationId`. Removing them from the protocol would break wire-compat for existing CF orchestrator code and the dispatch namespace contract. Removing them from the driver-facing API doesn't propagate: the underlying RunRecord still has them.

Accepted: in the single-tenant runtime, populate `tenantMeta` with literal defaults `{ tenantId: "default", projectId: "default", organizationId: "default" }` at the trigger boundary. Voyant Cloud's wrapper layer overrides with real per-org values via its multi-tenant routing. The protocol shape is preserved; single-tenant operators never see or set these fields.

### 21.19 Module/Plugin workflow fields use structural descriptors in core

Rejected: import `WorkflowDefinition` from `@voyantjs/workflows` into `packages/core/src/module.ts`. Creates a circular dependency (workflows already imports `Module` and `ModuleContainer` from core).

Accepted: define minimal structural types `WorkflowDescriptor` and `EventFilterDescriptor` in core. `Module.workflows: readonly WorkflowDescriptor[]`. `@voyantjs/workflows`'s concrete `WorkflowDefinition` and `EventFilterRuntimeEntry` satisfy these shapes via TypeScript structural compat. Same pattern Voyant uses for `LinkableDefinition` (`packages/core/src/links.ts`). One-way dependency preserved.

### 21.20 Driver is a factory function, not a pre-constructed object

Rejected: `workflows.driver: WorkflowDriver`. The framework can't pass the module container into an already-constructed driver without a setter API or a post-construction wrapper.

Accepted: `workflows.driver: DriverFactory` where `DriverFactory = (deps: { services, logger, db?, now? }) => WorkflowDriver`. `createNodeStandaloneDriver({...})` and `createCloudflareEdgeDriver({...})` return factories, not drivers. `createApp()` invokes the factory after the container is built. `WorkflowDriver` interface stays clean; container threading uses normal function argument plumbing.

### 21.21 Cancel does not run compensations by default

The orchestrator core's `cancel()` (`packages/workflows-orchestrator/src/orchestrator.ts:7,298`) marks the run cancelled and best-effort aborts the in-flight step. It does NOT run registered compensations. Compensations only fire via explicit `ctx.compensate()` (which throws `CompensateRequestedSignal`) or via step body failure unwinding.

Accepted as the v1 behavior. Compliance suite tests reflect this — there is NO test asserting "cancel runs comps." If we ever want cancel-runs-compensations as a default, that's a deliberate engine behavior change tracked in a separate follow-up issue, not a compliance test rewrite.

### 21.22 Manifest registration is fail-closed

If `workflows: ...` is configured, `driver.registerManifest()` failure rejects `bootstrapPromise` and surfaces as a 503 on the next request. We do NOT isolate-and-log this like module-bootstrap failures. Silently skipping registration would leave the runtime in a state where some events fire workflows and others vanish — a worse failure mode than refusing to serve traffic.

### 21.23 `workflows.db` is a long-lived connection separate from per-request DB

The Mode 2 time wheel and its optional `LISTEN/NOTIFY` consumer require a connection that persists between ticks. Per-request DB factories (e.g., `withDbFromEnv` patterns in CF Workers) do not satisfy this. `workflows.db` accepts a connection string (framework manages the Pool) or a pre-built Pool (caller manages). The framework documents this and refuses to accept a `DbFactory` shape.

## 22. Open questions

Resolve at PR review time; not blocking design sign-off.

1. **Manifest `versionId` derivation.** §14.1 proposes `sha256(canonical(manifest)).slice(0,16)`. Confirm 16 hex chars is fine for log searchability.
2. **Driver retry on registration.** Recommend 3 retries with exponential backoff for the bootstrap registration call, then log + continue. No event-time retries.
3. **Path index syntax.** `data.items[0]` is supported. `data.items[]` (any-element) is not. Defer until a use-case appears.
4. **Wildcard event types.** `trigger.on("booking.*", ...)` — useful for fan-out subscribers (audit). Defer to a future revision; v1 is exact-match only.
5. **`metadata` envelope contract.** Recommend defining `EventEnvelopeMetadata` extension in `@voyantjs/workflows/events` with workflow-specific fields: `eventId` (always stamped by forwarder), `tenantId`, `actorId`, `requestId?`, `traceId?`. Layer on top of the open-shaped `EventMetadata` (`packages/core/src/events.ts:30`).
6. **Mode 2 time wheel batch size.** Recommend 32, configurable via `tickBatchSize` opt.
7. **Driver shutdown semantics.** Drain in-flight steps, refuse new triggers, wait up to `gracefulShutdownMs` (default 30 s), force-cancel after.
8. **Counter persistence.** v1 in-process counters are logger-side (ephemeral). Postgres-backed counters are a follow-up.
9. **Default service container keys.** §11.4 proposes `db`, `eventBus`, `logger`, `now` plus module-name keys. Confirm no collisions and document the canonical key list.
10. **Workflow id namespace.** Modules: `<module-name>.<workflow-slug>`. Plugins: `<plugin-name>.<workflow-slug>`. Templates: unprefixed. Validate uniqueness at boot.

## 23. Implementation plan

The branch `feat/workflows-runtime` lands as **4 sequenced PRs**, each independently reviewable and shippable.

### PR1 — `WorkflowDriver` factory, Mode 2 extensions, container threading, idempotency wiring

The biggest piece. Defines the driver-as-factory contract (§6.3, §21.20), extends `@voyantjs/workflows-orchestrator-node` with the manifest store + idempotency column (§7.2, §21.17), threads `ModuleContainer` through to `WorkflowContext.services` (§11, §21.13), and wires `TriggerOptions.idempotencyKey` end-to-end (§15.2, §21.20-area).

Files (new):
- `packages/workflows/src/driver.ts` — `WorkflowDriver` + `WorkflowAdmin` interfaces; `DriverFactory` type alias; types, errors.
- `packages/workflows/src/driver-inmemory.ts` — `createInMemoryDriver()` returning a `DriverFactory` for tests.
- `packages/workflows-orchestrator/src/event-router.ts` — pure dispatcher used by both modes.
- `packages/workflows-orchestrator/src/__tests__/driver-compliance.test.ts` — shared compliance suite.
- `packages/workflows-orchestrator-node/src/postgres-manifest-store.ts` — `createPostgresManifestStore` (the new `ManifestStore` interface against `voyant_workflow_manifests`).
- `packages/workflows-orchestrator-node/src/node-standalone-driver.ts` — `createNodeStandaloneDriver(opts): DriverFactory`; composes existing `createPostgresSnapshotRunStore` + `createPersistentWakeupManager` + new manifest store + new event-router.
- `packages/workflows-orchestrator-node/drizzle/0003_idempotency_key.sql` — `voyant_snapshot_runs` adds `idempotency_key` column + unique partial index.
- `packages/workflows-orchestrator-node/drizzle/0004_workflow_manifests.sql` — `voyant_workflow_manifests` table + `is_current` partial unique index.

Files (modified):
- `packages/core/src/module.ts` — adds structural `WorkflowDescriptor` + `EventFilterDescriptor` types; `Module.workflows`, `Module.eventFilters` reference them. No import from `@voyantjs/workflows`.
- `packages/core/src/plugin.ts` — same descriptor-based fields on `Plugin`.
- `packages/workflows/src/handler/index.ts` — `StepHandlerDeps` gains `services?: ModuleContainer`.
- `packages/workflows/src/runtime/ctx.ts` — `CtxBuildArgs` gains `services?`; `buildCtx` exposes it on `WorkflowContext`.
- `packages/workflows/src/workflow.ts` — `WorkflowContext` gains `services: ModuleContainerView`.
- `packages/workflows-orchestrator/src/orchestrator.ts` — `TriggerArgs` gains `idempotencyKey?: string`; `trigger()` honors it (returns the existing run on conflict, deterministic across retries). The InMemory store enforces by checking an in-process map; Mode 2 enforces via the new `voyant_snapshot_runs_idempotency_idx` unique partial index; Mode 1 enforces via deterministic `runId` derivation in `apps/workflows-orchestrator-worker/src/worker.ts:165` (same idempotency key → same DO id).
- `packages/workflows-orchestrator-node/src/postgres-snapshot-run-store.ts` — extends `createPostgresSnapshotRunStore` to read `triggerArgs.idempotencyKey`, populate the column on insert, and `INSERT … ON CONFLICT DO NOTHING RETURNING id` for dedup.
- `packages/workflows-orchestrator-node/src/index.ts` — exports the new manifest store + driver factory.
- `packages/workflows/package.json` — add `./driver` and `./driver-inmemory` exports.

Tests:
- Compliance suite runs against `InMemory` and `Mode 2` (existing `voyant_snapshot_runs` + `voyant_wakeups` tables, with the two new migrations applied; Mode 1 slot added in PR3).
- Compliance suite includes `"trigger with idempotencyKey deduplicates"` — exercises the new wiring across all stores.
- Manifest store tests (against `voyant_workflow_manifests`): registerManifest idempotency, getCurrent, pruneToVersions(n).
- Container-threading test: a workflow body resolves a service from `ctx.services` registered by the harness.
- Migration test: 0003 + 0004 apply cleanly on top of the existing 0000-0002 schema.

Acceptance: compliance suite green for both drivers; `pnpm typecheck` clean; `pnpm -F @voyantjs/workflows-orchestrator-node test` green including the two new migrations.

PR1 also adds the **single engine fix** that #514 depends on: `TriggerOptions.idempotencyKey` enforcement (currently declared-only — see §3 audit-findings non-goal). Other audit-found gaps (concurrency, schedule firing, debounce/delay/ttl/priority/concurrencyKey) are explicitly out of scope and tracked as separate follow-up issues (#516, #517, #518).

### PR2 — `trigger.on()` runtime, predicate / mapper DSLs, manifest builder

SDK additions; no orchestrator changes; no driver changes (other than consuming the new types).

Files (new):
- `packages/workflows/src/events/{registry,predicate,input-mapper,manifest-builder,payload-hash,index}.ts`.
- `packages/workflows/src/events/__tests__/event-id-derivation.test.ts` — covers the §15.2 fallback.

Files (modified):
- `packages/workflows/src/trigger.ts` — `trigger.on()` becomes a runtime collector.
- `packages/workflows/src/protocol/index.ts` — `EventFilterManifestEntry` shape change.
- `packages/workflows/package.json` — add `./events` export.

Path roots (`data.*`, `metadata.*`, `name`, `emittedAt`) match `EventEnvelope`. The compliance suite from PR1 gains `ingestEvent` tests.

Acceptance: full compliance suite green; both drivers route events correctly using the real envelope shape.

### PR3 — Mode 1 (Cloudflare) wiring + optional HTTP ingest adapter

Add `/api/manifests` and `/api/events` to the existing CF orchestrator; ship the Mode 1 driver factory; ship the optional HTTP ingest adapter for Mode 2 + voyant-cloud reuse.

Files (new):
- `packages/workflows/src/driver-cloudflare-edge.ts` — `createCloudflareEdgeDriver`.
- `packages/workflows/src/http-ingest.ts` — `mountHttpIngestAdapter`.
- `packages/workflows-orchestrator-cloudflare/src/{manifest-kv-store,event-handler,manifest-handler}.ts`.

Files (modified):
- `packages/workflows-orchestrator-cloudflare/src/worker.ts` — mount new routes.
- `apps/workflows-orchestrator-worker/{src/worker.ts,wrangler.jsonc}` — wire `WORKFLOW_MANIFESTS` KV binding.

Tests:
- Mode 1 driver against an in-process orchestrator-worker fixture.
- Compliance suite parameterized over Mode 1.
- Request-level orchestrator tests for each new route.
- HTTP ingest adapter mounted on a Mode 2 setup; verify external POST → run created.

Acceptance: compliance suite green for all three drivers; orchestrator integration tests pass.

### PR4 — Module + plugin declaration surface, `createApp()` wiring, promotions migration (closes #515)

Wire it all together; close #515 by migrating the `affected.kind === "all"` paths.

Files (modified):
- `packages/core/src/module.ts` — `Module.workflows`, `Module.eventFilters`.
- `packages/core/src/plugin.ts` — `Plugin.workflows`, `Plugin.eventFilters`.
- `packages/hono/src/app.ts` — accept `workflows.db` shorthand or `workflows.driver`; collect; in the lazy bootstrap path: build manifest, register, install EventBus forwarder. Expose `app.ready()`.

Files (new):
- `packages/promotions/src/workflows/bulk-reindex-products.ts`.
- `packages/promotions/src/event-filters.ts`.
- `packages/promotions/src/services.ts` — typed accessors per §11.3.

Files (modified):
- `packages/promotions/src/index.ts` — export `workflows` + `eventFilters`.
- `templates/operator/src/api/catalog-bridge.ts` — delete the `affected.kind === "all"` warn block.
- `templates/operator/src/api/promotion-scheduled.ts` — emit `promotion.changed` instead of warning; remove inline indexer call for the all-affected case.

Tests:
- `createApp` boot with a module that ships workflows + filters; verify manifest registration and forwarder wiring (against the InMemory driver).
- Workflow body unit tests against mocked indexer + paginated repo (via `createInMemoryDriver({ services })`).
- Integration test: emit a `promotion.changed` event with `affected.kind === "all"`; assert a run is created.

Acceptance: `pnpm typecheck` clean; integration test green; the two `console.warn` blocks no longer exist in `git grep`.

### Sequencing constraints

PR1 → PR2 → PR3 must merge in order (PR2 depends on PR1's `WorkflowDriver` + container; PR3 depends on PR2's manifest types). PR4 depends on at least PR2 and one driver from PR1; can start in parallel with PR3.

## 24. Test strategy

| Layer | Type | Coverage |
|---|---|---|
| `predicate.ts` | unit | exhaustive truth table; edge cases (missing paths, type mismatches, deep arrays) using `EventEnvelope` shape |
| `input-mapper.ts` | unit | pass-through, scalar, object, nested, undefined-required |
| `manifest-builder.ts` | unit | hash stability, duplicate detection, schema validation |
| `event-router.ts` | unit | (manifest, envelope) → matches; multi-filter same eventName; unknown eventName |
| `event-id-derivation` | unit | metadata.eventId override; fallback; collision corner case |
| `driver-inmemory` | compliance suite | full suite |
| `driver-postgres` (Mode 2) | compliance suite + time-wheel-specific | full suite + claim/crash recovery |
| `driver-cloudflare-edge` (Mode 1) | compliance suite | full suite via in-process orchestrator-worker |
| Container threading | integration | workflow body resolves a registered service via `ctx.services` |
| `manifest-kv-store` | unit | InMemory contract conformance |
| `event-handler` (CF orchestrator) | request-level | full round-trip with mocked DO trigger |
| `manifest-handler` (CF orchestrator) | request-level | POST + GET happy path, auth, validation |
| `http-ingest` adapter | integration | mounted on a Mode 2 app; external POST → run created |
| `createApp()` workflow wiring | integration | module declares filter; emit; assert run; `app.ready()` resolves |
| `bulk-reindex-products` body | unit | paginated reindex against mocked builder via in-memory container |

No new test infrastructure required beyond `TEST_DATABASE_URL` for the Mode 2 compliance run.

## 25. References

- Issue: voyantjs/voyant#514 — Implement trigger.on() runtime in workflow orchestrator.
- Follow-up: voyantjs/voyant#515 — Move `affected.kind === "all"` reindex onto a workflow (closes when PR4 lands).
- Audit-found follow-ups (filed):
  - voyantjs/voyant#516 — Wire ConcurrencyPolicy enforcement.
  - voyantjs/voyant#517 — Implement schedule firing (cron / every / at).
  - voyantjs/voyant#518 — Wire TriggerOptions enforcement (delay, ttl, debounce, priority, concurrencyKey).
- Follow-up issues to file (one per row in §20's "Follow-up issue" rows).
- Voyant Cloud deployment: `/Users/mihai/builds/internal/voyant-all/voyant-cloud` (proprietary repo; out of scope here).
- Related architecture: `docs/architecture/event-delivery-and-durable-execution-policy.md` (especially §3, §6); `docs/architecture/workflows-monorepo-migration-plan.md`; `docs/architecture/promotions-architecture.md` §9.1, §9.2.
- Existing surface: `packages/core/src/{events,container,module,plugin}.ts`; `packages/workflows/src/{trigger,protocol/index,workflow,handler/index,runtime/ctx}.ts`; `packages/workflows-orchestrator/src/{orchestrator,types,in-memory-store}.ts`; `packages/workflows-orchestrator-cloudflare/src/{worker,durable-object,types,do-store}.ts`; `apps/workflows-orchestrator-worker/src/worker.ts`; `templates/operator/src/api/{catalog-bridge,promotion-scheduled}.ts`; `packages/hono/src/app.ts`.
