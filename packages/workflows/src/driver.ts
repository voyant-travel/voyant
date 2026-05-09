// The WorkflowDriver contract.
//
// A driver is the runtime-side object that backs `createApp({ workflows })`:
// it owns manifest registration, run triggering, event ingest, and (optionally)
// admin reads. Concrete drivers live in downstream packages
// (`@voyantjs/workflows-orchestrator` for InMemory, `-node` for Mode 2 / Postgres,
// `-cloudflare` for Mode 1 / DO+KV).
//
// Drivers are constructed via *factories* — `DriverFactory` is a function the
// framework invokes after `createApp()` has assembled its `ModuleContainer`.
// This lets concrete factories accept their environment-specific options
// (DO namespaces, DB pool, etc.) at user-call time and receive framework
// deps (services, logger, …) at boot time, without a setter API.
//
// Authoritative architecture: docs/architecture/workflows-runtime-architecture.md §6.

import type { WorkflowManifest } from "./protocol/index.js"
import type { ListRunsOptions, Run, RunDetail, RunSummary, TriggerOptions } from "./trigger.js"
import type { EnvironmentName, WaitpointKind } from "./types.js"
import type { WorkflowDefinition } from "./workflow.js"

// ---- Structural deps (kept local to avoid an @voyantjs/core dep here) ----

/**
 * Read-only view of a service container. Step bodies resolve services via
 * `ctx.services.resolve(...)`. The framework's `ModuleContainer`
 * (in `@voyantjs/core`) satisfies this shape structurally; we don't import
 * it directly to keep `@voyantjs/workflows` a leaf package.
 */
export interface ServiceResolver {
  resolve<T>(name: string): T
  has(name: string): boolean
}

/**
 * Structural shape of an event envelope as ingested by a driver. Matches
 * `EventEnvelope` from `@voyantjs/core` (`name`, `data`, `metadata?`, `emittedAt`),
 * declared structurally so the SDK package doesn't import core.
 */
export interface IngestEventEnvelope<TData = unknown> {
  /** Event name in `<resource>.<pastTenseAction>` form. */
  name: string
  /** Business payload. */
  data: TData
  /** Optional metadata. `metadata.eventId` is the canonical idempotency seed
   *  (a fresh ULID, stamped by the framework's EventBus forwarder). External
   *  callers may supply their own. See architecture doc §15.2. */
  metadata?: Record<string, unknown> & { eventId?: string }
  /** ISO timestamp string. */
  emittedAt: string
}

/**
 * Minimal logger contract drivers can rely on. Matches the framework logger's
 * call signature without taking a hard dependency on it.
 */
export type DriverLogger = (
  level: "debug" | "info" | "warn" | "error",
  msg: string,
  data?: object,
) => void

// ---- Driver-factory wiring ----

/**
 * Deps the framework injects into a `DriverFactory` at boot. Driver factories
 * close over their environment-specific options (DO bindings, DB pool, etc.)
 * and read framework deps from this argument.
 */
export interface DriverFactoryDeps {
  /** Read-only view of the framework's `ModuleContainer`. */
  services: ServiceResolver
  /** Framework logger. */
  logger: DriverLogger
  /** Injectable clock — defaults to `() => Date.now()`. */
  now?: () => number
}

/**
 * Concrete driver factories return this. `createApp()` calls it once, after
 * the container is built, to obtain the `WorkflowDriver`.
 */
export type DriverFactory = (deps: DriverFactoryDeps) => WorkflowDriver

// ---- Event ingest types ----

/**
 * Argument to `driver.ingestEvent(...)`. The framework's EventBus forwarder
 * builds this from the core `EventEnvelope`; external HTTP callers (the
 * optional ingest adapter, voyant-cloud) build it from a wire payload.
 */
export interface IngestEventArgs {
  environment: EnvironmentName
  envelope: IngestEventEnvelope
  /** Optional caller-supplied idempotency override. When absent, the driver
   *  derives a key per match from `metadata.eventId` (or a content hash
   *  fallback). See architecture doc §15.2. */
  idempotencyKey?: string
}

/** Per-filter outcome from a single `ingestEvent` call. */
export type IngestMatch =
  | {
      filterId: string
      targetWorkflowId: string
      runId: string
      idempotencyKey: string
      status: "queued"
    }
  | {
      filterId: string
      status: "skipped"
      reason: "where_eval_error" | "input_projection_error" | "input_schema_violation"
      details?: string
    }
  | {
      filterId: string
      targetWorkflowId: string
      status: "error"
      reason: string
    }

export type IngestEventResponse =
  | {
      ok: true
      eventId: string
      matches: IngestMatch[]
    }
  | {
      ok: false
      reason:
        | "manifest_not_registered"
        | "environment_mismatch"
        | "payload_too_large"
        | "trigger_failed_for_all_matches"
      message?: string
    }

// ---- Driver — execution contract ----

/**
 * The mandatory driver contract. Every concrete driver — InMemory, Mode 2
 * (Postgres), Mode 1 (CF edge) — implements all five methods. The compliance
 * test suite (`driver-compliance.test.ts`) is the contract.
 */
export interface WorkflowDriver {
  /**
   * Idempotent. Same manifest body returns the same `versionId` across calls.
   * Failures are NOT swallowed — `createApp()`'s bootstrap surfaces rejections
   * (see architecture doc §21.22).
   */
  registerManifest(args: {
    environment: EnvironmentName
    manifest: WorkflowManifest
  }): Promise<{ versionId: string }>

  /**
   * Trigger a workflow run by id or definition handle. Honors
   * `opts.idempotencyKey` for dedup (returns the existing run on conflict).
   */
  trigger<TIn, TOut>(
    workflow: WorkflowDefinition<TIn, TOut> | string,
    input: TIn,
    opts?: TriggerOptions,
  ): Promise<Run<TOut>>

  /**
   * Ingest one event. Synchronously (from the caller's POV) loads the
   * registered manifest, evaluates `where`, projects `input`, and triggers
   * one run per match. See architecture doc §15.
   */
  ingestEvent(args: IngestEventArgs): Promise<IngestEventResponse>

  /**
   * Read the registered manifest. Used at boot for version-mismatch detection
   * and by the dashboard for filter inspection.
   */
  getManifest(args: { environment: EnvironmentName }): Promise<WorkflowManifest | null>

  /**
   * Optional. Drains in-flight steps, refuses new triggers, awaits time-wheel
   * exit. Default `gracefulMs` is 30_000.
   */
  shutdown?(opts?: { gracefulMs?: number }): Promise<void>

  /**
   * Optional read-side surface. Drivers that can support listings, run detail,
   * and journal streams declare this; consumers (the dashboard) duck-type on
   * `driver.admin`. See architecture doc §6.2.
   */
  admin?: WorkflowAdmin | Partial<WorkflowAdmin>
}

// ---- Driver — admin (optional) ----

/**
 * Read-side operations. Implemented natively by the Mode 2 driver against
 * Postgres, partially by Mode 1 (single-run reads only — `listRuns` is not
 * implemented in self-host Mode 1; voyant-cloud provides an index layer).
 * See architecture doc §6.2 + §8.3.
 */
export interface WorkflowAdmin {
  listRuns(opts?: ListRunsOptions): Promise<{ runs: RunSummary[]; nextCursor?: string }>
  getRun(runId: string): Promise<RunDetail | null>
  cancelRun(runId: string, opts?: { reason?: string; compensate?: boolean }): Promise<void>
  /**
   * Subscribe to journal events for a run. The async-iterable shape lets
   * dashboards stream live without polling.
   */
  streamRun(runId: string): AsyncIterable<AdminStreamEvent>
}

/**
 * The admin streaming surface re-uses the protocol's `StreamEvent` for
 * step/waitpoint/log events; this type is its alias to keep the import
 * surface narrow.
 */
export type AdminStreamEvent =
  | { kind: "run.snapshot"; at: number; status: string; metadata: Record<string, unknown> }
  | { kind: "step.started"; at: number; stepId: string; runtime: "edge" | "node" }
  | { kind: "step.ok"; at: number; stepId: string; durationMs: number }
  | { kind: "step.err"; at: number; stepId: string; error: { code: string; message: string } }
  | { kind: "waitpoint.registered"; at: number; waitpointId: string; waitpointKind: WaitpointKind }
  | { kind: "waitpoint.resolved"; at: number; waitpointId: string }
  | { kind: "log"; at: number; level: "info" | "warn" | "error"; message: string }
  | { kind: "run.finished"; at: number; status: string }

// ---- Errors ----

/**
 * Base class for typed driver errors. Concrete subclasses below; consumers
 * `instanceof` to handle specific cases.
 */
export class WorkflowDriverError extends Error {
  readonly code: string
  readonly cause?: unknown

  constructor(code: string, message: string, opts?: { cause?: unknown }) {
    super(message)
    this.name = "WorkflowDriverError"
    this.code = code
    this.cause = opts?.cause
  }
}

export class ManifestNotRegisteredError extends WorkflowDriverError {
  constructor(environment: EnvironmentName) {
    super(
      "manifest_not_registered",
      `No manifest is registered for environment "${environment}". ` +
        `createApp() must complete its bootstrap before driver.ingestEvent(...) can fire.`,
    )
    this.name = "ManifestNotRegisteredError"
  }
}

export class EventTooLargeError extends WorkflowDriverError {
  readonly bytes: number
  readonly limit: number

  constructor(bytes: number, limit = 256 * 1024) {
    super("payload_too_large", `Event payload is ${bytes} bytes, exceeding the ${limit}-byte cap.`)
    this.name = "EventTooLargeError"
    this.bytes = bytes
    this.limit = limit
  }
}

export class EnvironmentMismatchError extends WorkflowDriverError {
  constructor(eventEnv: EnvironmentName, manifestEnv: EnvironmentName) {
    super(
      "environment_mismatch",
      `Event environment "${eventEnv}" does not match the registered manifest's environment "${manifestEnv}".`,
    )
    this.name = "EnvironmentMismatchError"
  }
}
