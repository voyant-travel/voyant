// @voyantjs/workflows-orchestrator
//
// Reference orchestrator for Voyant Workflows. Drives runs through
// the tenant step handler over the v1 wire protocol. Transport- and
// storage-agnostic: compose with a RunRecordStore of your choice
// (in-memory for tests, Postgres-backed for production).
//
// See docs/runtime-protocol.md §2 + §5 for the contract this
// implements and docs/design.md §6 for the broader orchestrator
// state-machine design.

export {
  registerRunAbort,
  signalRunAbort,
  unregisterRunAbort,
} from "./abort-registry.js"
export { applyWaitpointInjection, type DriveOptions, driveUntilPaused } from "./drive.js"
export {
  createInMemoryDriver,
  type InMemoryDriverOptions,
} from "./driver-inmemory.js"
export {
  createHttpStepHandler,
  type HttpStepHandlerDeps,
  type HttpStepTarget,
} from "./http-step-handler.js"
export { createInMemoryRunStore } from "./in-memory-store.js"
export { emptyJournal } from "./journal-helpers.js"
export {
  type CancelArgs,
  cancel,
  type OrchestratorDeps,
  type ResumeArgs,
  type ResumeDueAlarmsArgs,
  resume,
  resumeDueAlarms,
  type TriggerArgs,
  trigger,
} from "./orchestrator.js"
export * from "./types.js"
