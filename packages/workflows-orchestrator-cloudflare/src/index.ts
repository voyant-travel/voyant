// @voyantjs/workflows-orchestrator-cloudflare
//
// Cloudflare Worker + Durable Object adapter for @voyantjs/workflows-orchestrator.
// Composes the protocol-agnostic state machine in @voyantjs/workflows-orchestrator
// with a DO-backed run store and a dispatch-namespace step handler.
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
//     "dispatch_namespaces": [
//       { "binding": "DISPATCHER", "namespace": "voyant-tenants" }
//     ],
//     "migrations": [
//       { "tag": "v1", "new_sqlite_classes": ["WorkflowRunDO"] }
//     ]
//   }
//
// See docs/runtime-protocol.md §2 and docs/design.md §6 for the
// design this adapter implements.

export {
  type BundleLocation,
  type CfContainerRunnerDeps,
  type ContainerNamespaceLike,
  createCfContainerStepRunner,
} from "./cf-container-runner.js"
export {
  type CloudflareEdgeDriverOptions,
  createCloudflareEdgeDriver,
} from "./cloudflare-edge-driver.js"
export {
  createDispatchStepHandler,
  type DispatchHandlerDeps,
} from "./dispatch-handler.js"
export {
  createHttpDispatcher,
  createInlineDispatcher,
  createServiceBindingDispatcher,
  createWfpDispatcher,
  type HttpDispatcherOptions,
  type ServiceBindingDispatcherOptions,
  type ServiceBindingLike,
  type StepDispatcher,
  type StepDispatcherContext,
  type WfpDispatcherOptions,
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
  createR2Presigner,
  type PresignArgs,
  type R2PresignerOptions,
} from "./r2-sign.js"
export * from "./types.js"
export {
  type DurableObjectNamespaceLike,
  handleWorkerRequest,
  type WorkerFetchDeps,
} from "./worker.js"
