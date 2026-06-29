import type { createServer } from "node:http"
import type { ServiceResolver } from "@voyant-travel/workflows/driver"
import type { WaitpointInjection } from "./core.js"
import type { ChunkBus } from "./dashboard-chunks.js"
import type { SchedulerHandle } from "./scheduler.js"
import type { SnapshotRunStore, StoredRun } from "./snapshot-run-store.js"

export interface ServeDeps {
  store: SnapshotRunStore
  createServer: typeof createServer
  shutdown?: () => void | Promise<void>
  healthCheck?: () => Promise<HealthReport> | HealthReport
  readinessCheck?: () => Promise<HealthReport> | HealthReport
  collectMetrics?: () => Promise<string> | string
  staticDir?: string
  readStatic?: (path: string) => Promise<Uint8Array | null>
  triggerRun?: (args: {
    workflowId: string
    input: unknown
    runId?: string
    tags?: string[]
    triggeredByUserId?: string | null
  }) => Promise<{ ok: true; saved: StoredRun } | { ok: false; message: string; exitCode: number }>
  resumeRun?: (args: {
    parentRunId: string
    workflowId?: string
    input?: unknown
    resumeFromStep?: string
    seedResults?: Record<string, unknown>
    runId?: string
    tags?: string[]
    triggeredByUserId?: string | null
  }) => Promise<
    | { ok: true; saved: StoredRun; parentRunId: string; resumeFromStep: string }
    | { ok: false; message: string; exitCode: number }
  >
  listWorkflows?: () => { id: string; description?: string }[]
  injectWaitpoint?: (args: {
    runId: string
    injection: WaitpointInjection
  }) => Promise<{ ok: true; saved: StoredRun } | { ok: false; message: string; exitCode: number }>
  scheduler?: SchedulerHandle
  listSchedules?: () => { workflowId: string; name?: string; nextAt: number; done: boolean }[]
  cancelRun?: (args: {
    runId: string
  }) => Promise<{ ok: true; saved: StoredRun } | { ok: false; message: string; exitCode: number }>
  chunkBus?: ChunkBus
}

export interface RequestHandlerDeps {
  store: SnapshotRunStore
  healthCheck?: ServeDeps["healthCheck"]
  readinessCheck?: ServeDeps["readinessCheck"]
  collectMetrics?: ServeDeps["collectMetrics"]
  readStatic?: (path: string) => Promise<Uint8Array | null>
  hasStaticDashboard?: boolean
  triggerRun?: ServeDeps["triggerRun"]
  resumeRun?: ServeDeps["resumeRun"]
  listWorkflows?: ServeDeps["listWorkflows"]
  injectWaitpoint?: ServeDeps["injectWaitpoint"]
  listSchedules?: ServeDeps["listSchedules"]
  cancelRun?: ServeDeps["cancelRun"]
}

export interface HandlerResponse {
  status: number
  headers: Record<string, string>
  body: string | Uint8Array
}

export interface HealthReport {
  ok: boolean
  service?: string
  checks?: Record<string, "ok" | "error">
  details?: Record<string, unknown>
}

export interface MetricsSnapshot {
  workflowsRegistered: number
  schedulesRegistered: number
  runsTotal: number
  wakeupsTotal: number
  runsByStatus: Record<string, number>
  generatedAtMs: number
}

export interface ServeHandle {
  close: () => Promise<void>
  url: string
}

export interface SelfHostServerOptions {
  entryFile: string
  port?: number
  host?: string
  staticDir?: string
  cacheBustEntry?: boolean
  services?: ServiceResolver
  store?: SnapshotRunStore
  databaseUrl?: string
  wakeupPollIntervalMs?: number
  wakeupLeaseMs?: number
  wakeupLeaseOwner?: string
}
