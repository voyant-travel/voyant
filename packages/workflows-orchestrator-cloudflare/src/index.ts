// @voyant-travel/workflows-orchestrator-cloudflare
//
// Cloudflare Worker + Durable Object adapter for @voyant-travel/workflows-orchestrator.
// Composes the protocol-agnostic state machine with a DO-backed run
// store and a pluggable step dispatcher (`StepDispatcher`).
//
// Typical wrangler.jsonc layout:
//
//   {
//     "name": "voyant-orchestrator",
//     "main": "src/worker.ts",
//     "compatibility_date": "2025-01-01",
//     "durable_objects": {
//       "bindings": [
//         { "name": "WORKFLOW_RUN_DO", "class_name": "WorkflowRunDO" }
//       ]
//     },
//     "migrations": [
//       { "tag": "v1", "new_sqlite_classes": ["WorkflowRunDO"] }
//     ]
//   }
//
// Pick a dispatcher in your DO's `deps()` based on where workflow
// code lives:
//   * createInlineDispatcher          — same Worker as the orchestrator
//   * createServiceBindingDispatcher  — sibling Worker via service binding
//   * createHttpDispatcher            — arbitrary HTTP endpoint
//
// Hosted multi-tenant providers implement custom dispatchers in their
// own deployment code.
//
// See docs/runtime-protocol.md §2 and docs/design.md §6 for the
// design this adapter implements.

export {
  type CloudflareEdgeDriverOptions,
  createCloudflareEdgeDriver,
} from "./cloudflare-edge-driver.js"
export {
  type ConcurrencyCoordinator,
  type ConcurrencyCoordinatorDeps,
  createConcurrencyCoordinator,
  handleConcurrencyCoordinatorRequest,
} from "./concurrency-coordinator.js"
export {
  createHttpDispatcher,
  createInlineDispatcher,
  createServiceBindingDispatcher,
  type HttpDispatcherOptions,
  type ServiceBindingDispatcherOptions,
  type ServiceBindingLike,
  type StepDispatcher,
  type StepDispatcherContext,
} from "./dispatchers.js"
export { createDurableObjectRunStore } from "./do-store.js"
export {
  type DurableObjectDeps,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
} from "./durable-object.js"
export {
  type CfManifestEnvelope,
  type CfManifestStore,
  type CreateKvManifestStoreOptions,
  createInMemoryKv,
  createKvManifestStore,
  type KvNamespaceLike,
} from "./manifest-kv-store.js"
export {
  handleGetSchedules,
  type ScheduleHandlerDeps,
  type ScheduleListResponse,
  type ScheduleSummary,
} from "./schedule-handler.js"
export {
  type CfScheduleStateStore,
  type CreateKvScheduleStateStoreOptions,
  createKvScheduleStateStore,
  type ScheduleStateRecord,
} from "./schedule-state-store.js"
export * from "./types.js"
export {
  type DurableObjectNamespaceLike,
  handleWorkerRequest,
  type WorkerFetchDeps,
} from "./worker.js"
