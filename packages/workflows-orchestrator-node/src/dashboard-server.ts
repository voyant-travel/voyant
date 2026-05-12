import { readFile, stat } from "node:fs/promises"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { extname, join, resolve as resolvePath } from "node:path"
import { URL } from "node:url"
import type { ServiceResolver } from "@voyantjs/workflows/driver"
import { handleStepRequest, type StepRunner } from "@voyantjs/workflows/handler"
import { createInMemoryRateLimiter } from "@voyantjs/workflows/rate-limit"
import {
  createInMemoryRunStore,
  type RunRecord,
  resume,
  resumeDueAlarms,
  type StepHandler,
  trigger,
  type WaitpointInjection,
} from "@voyantjs/workflows-orchestrator"
import { loadEntryFile } from "./entry-loader.js"
import { durationToMs, generateLocalRunId } from "./local-runtime.js"
import { createPersistentWakeupManager } from "./persistent-wakeup-manager.js"
import { createPostgresConnection } from "./postgres.js"
import { createPostgresSnapshotRunStore } from "./postgres-snapshot-run-store.js"
import { createPostgresWakeupStore } from "./postgres-wakeup-store.js"
import { buildResumeJournal, buildSeededResumeJournal } from "./resume-run.js"
import { recordToSnapshot, snapshotToRecord } from "./run-record-snapshot.js"
import { createScheduler, type SchedulerHandle, type ScheduleSource } from "./scheduler.js"
import {
  createFsSnapshotRunStore,
  type ListFilter,
  type SnapshotRunStore,
  type StoredRun,
} from "./snapshot-run-store.js"
import { createStoreStream, type StoreEvent, type StoreStream } from "./store-stream.js"
import { createFsWakeupStore } from "./wakeup-store.js"

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

export interface ChunkEvent {
  runId: string
  chunk: {
    streamId: string
    seq: number
    encoding: "text" | "json" | "base64"
    chunk: unknown
    final: boolean
    at: number
  }
}

export interface ChunkBus {
  publish(event: ChunkEvent): void
  subscribe(fn: (event: ChunkEvent) => void): () => void
}

export function createChunkBus(): ChunkBus {
  const subs = new Set<(event: ChunkEvent) => void>()
  return {
    publish(event) {
      for (const fn of subs) {
        try {
          fn(event)
        } catch {
          // Ignore subscriber errors so streaming keeps going.
        }
      }
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
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

export async function handleRequest(
  req: { method: string; url: string; body?: string },
  deps: RequestHandlerDeps,
): Promise<HandlerResponse> {
  const method = (req.method ?? "GET").toUpperCase()
  const url = new URL(req.url, "http://local")

  if (method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS, POST",
        "access-control-allow-headers": "content-type",
      },
      body: "",
    }
  }

  if (method === "POST") {
    const cancelMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/)
    if (cancelMatch) {
      if (!deps.cancelRun) {
        return json(501, {
          error: "cancel_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable cancellation.",
        })
      }
      const runId = decodeURIComponent(cancelMatch[1]!)
      const result = await deps.cancelRun({ runId })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "cancel_failed",
          message: result.message,
        })
      }
      return json(200, { saved: result.saved })
    }

    const resumeMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/resume$/)
    if (resumeMatch) {
      if (!deps.resumeRun) {
        return json(501, {
          error: "resume_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable failed-step resume.",
        })
      }
      const parsed = parseResumeRequestBody(req.body)
      if (!parsed.ok) {
        return json(parsed.status, { error: parsed.error, message: parsed.message })
      }
      const parentRunId = decodeURIComponent(resumeMatch[1]!)
      const result = await deps.resumeRun({ parentRunId, ...parsed.body })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "resume_failed",
          message: result.message,
        })
      }
      return json(200, {
        saved: result.saved,
        parentRunId: result.parentRunId,
        resumeFromStep: result.resumeFromStep,
      })
    }

    const eventsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/)
    const signalsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/signals$/)
    const tokenMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/tokens\/([^/]+)$/)
    if (eventsMatch || signalsMatch || tokenMatch) {
      if (!deps.injectWaitpoint) {
        return json(501, {
          error: "inject_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable event / signal / token injection.",
        })
      }
      let parsed: Record<string, unknown>
      try {
        parsed = req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {}
      } catch (err) {
        return json(400, {
          error: "invalid_json",
          message: err instanceof Error ? err.message : String(err),
        })
      }
      let injection: WaitpointInjection
      if (eventsMatch) {
        if (typeof parsed.eventType !== "string" || parsed.eventType.length === 0) {
          return json(400, { error: "invalid_body", message: "`eventType` (string) is required" })
        }
        injection = { kind: "EVENT", eventType: parsed.eventType, payload: parsed.payload }
      } else if (signalsMatch) {
        if (typeof parsed.name !== "string" || parsed.name.length === 0) {
          return json(400, { error: "invalid_body", message: "`name` (string) is required" })
        }
        injection = { kind: "SIGNAL", name: parsed.name, payload: parsed.payload }
      } else {
        injection = {
          kind: "MANUAL",
          tokenId: decodeURIComponent(tokenMatch![2]!),
          payload: parsed.payload,
        }
      }
      const runId = decodeURIComponent((eventsMatch?.[1] ?? signalsMatch?.[1] ?? tokenMatch?.[1])!)
      const result = await deps.injectWaitpoint({ runId, injection })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "inject_failed",
          message: result.message,
        })
      }
      return json(200, { saved: result.saved })
    }

    if (url.pathname === "/api/runs") {
      if (!deps.triggerRun) {
        return json(501, {
          error: "trigger_not_supported",
          message:
            "This self-host server was started without a workflow entry. " +
            "Restart with `--file <path>` to enable triggering.",
        })
      }
      let parsed: {
        workflowId?: unknown
        input?: unknown
        runId?: unknown
        tags?: unknown
        triggeredByUserId?: unknown
      }
      try {
        parsed = req.body ? JSON.parse(req.body) : {}
      } catch (err) {
        return json(400, {
          error: "invalid_json",
          message: err instanceof Error ? err.message : String(err),
        })
      }
      if (typeof parsed.workflowId !== "string" || parsed.workflowId.length === 0) {
        return json(400, {
          error: "invalid_body",
          message: "`workflowId` (string) is required",
        })
      }
      if (parsed.runId !== undefined && typeof parsed.runId !== "string") {
        return json(400, {
          error: "invalid_body",
          message: "`runId` must be a string when provided",
        })
      }
      if (parsed.tags !== undefined && !isStringArray(parsed.tags)) {
        return json(400, {
          error: "invalid_body",
          message: "`tags` must be an array of strings when provided",
        })
      }
      if (
        parsed.triggeredByUserId !== undefined &&
        parsed.triggeredByUserId !== null &&
        typeof parsed.triggeredByUserId !== "string"
      ) {
        return json(400, {
          error: "invalid_body",
          message: "`triggeredByUserId` must be a string or null when provided",
        })
      }
      const result = await deps.triggerRun({
        workflowId: parsed.workflowId,
        input: parsed.input,
        runId: parsed.runId,
        tags: parsed.tags,
        triggeredByUserId: parsed.triggeredByUserId,
      })
      if (!result.ok) {
        return json(result.exitCode === 2 ? 400 : 404, {
          error: "trigger_failed",
          message: result.message,
        })
      }
      return json(200, { saved: result.saved })
    }

    return json(404, { error: "route_not_found", path: url.pathname })
  }

  if (method !== "GET" && method !== "HEAD") {
    return json(405, { error: "method_not_allowed", allowed: ["GET", "HEAD", "OPTIONS", "POST"] })
  }

  if (url.pathname === "/healthz") {
    const report = await resolveHealthReport(deps.healthCheck, {
      ok: true,
      service: "voyant-workflows-selfhost",
    })
    return json(report.ok ? 200 : 503, report)
  }

  if (url.pathname === "/readyz") {
    const report = await resolveHealthReport(deps.readinessCheck, {
      ok: Boolean(deps.triggerRun),
      service: "voyant-workflows-selfhost",
      checks: {
        workflowEntry: deps.triggerRun ? "ok" : "error",
      },
      details: deps.triggerRun
        ? undefined
        : {
            workflowEntry: "This self-host server was started without a workflow entry.",
          },
    })
    return json(report.ok ? 200 : 503, report)
  }

  if (url.pathname === "/metrics") {
    const body = await resolveMetricsBody(deps.collectMetrics)
    return {
      status: 200,
      headers: {
        "content-type": "text/plain; version=0.0.4; charset=utf-8",
        "cache-control": "no-store",
      },
      body,
    }
  }

  if (url.pathname === "/" || url.pathname === "") {
    if (deps.hasStaticDashboard && deps.readStatic) {
      const bytes = await deps.readStatic("index.html")
      if (bytes) {
        return {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
          body: bytes,
        }
      }
    }
    return json(200, {
      service: "voyant workflows selfhost",
      endpoints: ["/api/runs", "/api/runs/:id"],
    })
  }

  if (deps.hasStaticDashboard && deps.readStatic && !url.pathname.startsWith("/api/")) {
    const clean = url.pathname.replace(/^\/+/, "")
    if (clean && !clean.includes("..")) {
      const bytes = await deps.readStatic(clean)
      if (bytes) {
        return {
          status: 200,
          headers: {
            "content-type": mimeFor(clean),
            "cache-control": "no-store",
          },
          body: bytes,
        }
      }
    }
  }

  if (url.pathname === "/api/workflows") {
    const workflows = deps.listWorkflows ? deps.listWorkflows() : []
    return json(200, { workflows })
  }

  if (url.pathname === "/api/schedules") {
    const schedules = deps.listSchedules ? deps.listSchedules() : []
    return json(200, { schedules })
  }

  if (url.pathname === "/api/runs") {
    const filter: ListFilter = {}
    const workflowId = url.searchParams.get("workflow") ?? url.searchParams.get("workflowId")
    if (workflowId) filter.workflowId = workflowId
    const status = url.searchParams.get("status")
    if (status) filter.status = status
    const limitRaw = url.searchParams.get("limit")
    if (limitRaw !== null) {
      const limit = Number.parseInt(limitRaw, 10)
      if (Number.isNaN(limit) || limit < 0) {
        return json(400, {
          error: "invalid_limit",
          message: `limit must be a non-negative integer (got "${limitRaw}")`,
        })
      }
      filter.limit = limit
    }
    const runs = await deps.store.list(filter)
    return json(200, { runs })
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/)
  if (runMatch) {
    const runId = decodeURIComponent(runMatch[1]!)
    const run = await deps.store.get(runId)
    if (!run) return json(404, { error: "not_found", runId })
    return json(200, { run })
  }

  return json(404, { error: "route_not_found", path: url.pathname })
}

function parseResumeRequestBody(body: string | undefined):
  | {
      ok: true
      body: {
        input?: unknown
        workflowId?: string
        resumeFromStep?: string
        seedResults?: Record<string, unknown>
        runId?: string
        tags?: string[]
        triggeredByUserId?: string | null
      }
    }
  | { ok: false; status: number; error: string; message: string } {
  let parsed: Record<string, unknown>
  try {
    parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {}
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: "invalid_json",
      message: err instanceof Error ? err.message : String(err),
    }
  }
  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "request body must be an object",
    }
  }
  if (parsed.resumeFromStep !== undefined && typeof parsed.resumeFromStep !== "string") {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`resumeFromStep` must be a string when provided",
    }
  }
  if (parsed.workflowId !== undefined && typeof parsed.workflowId !== "string") {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`workflowId` must be a string when provided",
    }
  }
  if (parsed.runId !== undefined && typeof parsed.runId !== "string") {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`runId` must be a string when provided",
    }
  }
  if (
    parsed.triggeredByUserId !== undefined &&
    parsed.triggeredByUserId !== null &&
    typeof parsed.triggeredByUserId !== "string"
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`triggeredByUserId` must be a string or null when provided",
    }
  }
  if (parsed.tags !== undefined && !isStringArray(parsed.tags)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`tags` must be an array of strings when provided",
    }
  }
  if (parsed.seedResults !== undefined && !isPlainObject(parsed.seedResults)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_body",
      message: "`seedResults` must be an object when provided",
    }
  }
  return {
    ok: true,
    body: {
      input: parsed.input,
      workflowId: parsed.workflowId as string | undefined,
      resumeFromStep: parsed.resumeFromStep,
      seedResults: parsed.seedResults as Record<string, unknown> | undefined,
      runId: parsed.runId,
      tags: parsed.tags as string[] | undefined,
      triggeredByUserId: parsed.triggeredByUserId as string | null | undefined,
    },
  }
}

export function createStaticReader(rootDir: string): (path: string) => Promise<Uint8Array | null> {
  const root = resolvePath(rootDir)
  return async (path: string) => {
    const absolute = resolvePath(root, path)
    if (!absolute.startsWith(`${root}/`) && absolute !== root) return null
    try {
      return await readFile(absolute)
    } catch {
      return null
    }
  }
}

export async function findDashboardDir(startFrom: string): Promise<string | undefined> {
  const candidates = [
    join(startFrom, "apps/workflows-local-dashboard/dist"),
    join(startFrom, "../local-dashboard/dist"),
    join(startFrom, "../../apps/workflows-local-dashboard/dist"),
    join(startFrom, "../../../apps/workflows-local-dashboard/dist"),
  ]
  for (const candidate of candidates) {
    try {
      const entry = await stat(join(candidate, "index.html"))
      if (entry.isFile()) return candidate
    } catch {
      // Continue scanning candidate locations.
    }
  }
  return undefined
}

export interface ServeHandle {
  close: () => Promise<void>
  url: string
}

export async function startServer(
  options: { port: number; host: string },
  deps: ServeDeps,
): Promise<ServeHandle> {
  const readStatic =
    deps.readStatic ?? (deps.staticDir ? createStaticReader(deps.staticDir) : undefined)
  const hasStaticDashboard = Boolean(readStatic)

  let storeStream: StoreStream | undefined
  const getStoreStream = (): StoreStream => {
    if (!storeStream) storeStream = createStoreStream(deps.store)
    return storeStream
  }

  const server: Server = deps.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = (req.method ?? "GET").toUpperCase()
    const url = req.url ?? "/"

    if ((method === "GET" || method === "HEAD") && urlPath(url) === "/api/runs/stream") {
      handleSseStream(res, getStoreStream(), deps.chunkBus)
      return
    }

    const perRunMatch = urlPath(url).match(/^\/api\/runs\/([^/]+)\/stream$/)
    if ((method === "GET" || method === "HEAD") && perRunMatch) {
      const runId = decodeURIComponent(perRunMatch[1]!)
      handleRunSseStream(res, runId, getStoreStream(), deps.chunkBus, deps.store)
      return
    }

    try {
      const body = method === "POST" ? await readRequestBody(req) : undefined
      const response = await handleRequest(
        { method, url, body },
        {
          store: deps.store,
          healthCheck: deps.healthCheck,
          readinessCheck: deps.readinessCheck,
          collectMetrics: deps.collectMetrics,
          readStatic,
          hasStaticDashboard,
          triggerRun: deps.triggerRun,
          resumeRun: deps.resumeRun,
          listWorkflows: deps.listWorkflows,
          injectWaitpoint: deps.injectWaitpoint,
          listSchedules: deps.listSchedules,
          cancelRun: deps.cancelRun,
        },
      )
      res.writeHead(response.status, response.headers)
      res.end(response.body)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "internal_error", message }))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(options.port, options.host, () => {
      server.off("error", reject)
      resolve()
    })
  })

  deps.scheduler?.start()

  return {
    url: `http://${options.host}:${options.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        deps.scheduler?.stop()
        storeStream?.stop()
        ;(server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.()
        server.close((err) => {
          if (err) {
            reject(err)
            return
          }
          Promise.resolve(deps.shutdown?.()).then(() => resolve(), reject)
        })
      }),
  }
}

export function handleSseStream(
  res: ServerResponse,
  stream: StoreStream,
  chunkBus?: ChunkBus,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  })
  res.write("retry: 3000\n\n")

  const writeEvent = (event: StoreEvent): void => {
    try {
      res.write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }

  const writeChunk = (event: ChunkEvent): void => {
    try {
      res.write(`event: stream.chunk\ndata: ${JSON.stringify(event)}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }

  const unsubscribeStore = stream.subscribe(writeEvent)
  const unsubscribeChunk = chunkBus ? chunkBus.subscribe(writeChunk) : () => {}
  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }, 25_000)
  ;(ping as unknown as { unref?: () => void }).unref?.()

  res.on("close", () => {
    clearInterval(ping)
    unsubscribeStore()
    unsubscribeChunk()
  })
}

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "compensated",
  "compensation_failed",
])

export function handleRunSseStream(
  res: ServerResponse,
  runId: string,
  stream: StoreStream,
  chunkBus: ChunkBus | undefined,
  store: SnapshotRunStore,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  })
  res.write("retry: 3000\n\n")

  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    try {
      res.end()
    } catch {
      // Ignore close failures.
    }
  }

  const writeEvent = (kind: string, data: unknown): void => {
    if (closed) return
    try {
      res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }

  void store.get(runId).then((run) => {
    if (run) {
      writeEvent("hello", { run })
      if (TERMINAL_STATUSES.has(run.status)) close()
    } else {
      writeEvent("hello", { run: null })
    }
  })

  const unsubscribeStore = stream.subscribe((event) => {
    if (event.kind === "added" || event.kind === "updated") {
      if (event.run.id !== runId) return
      writeEvent(event.kind, event)
      if (TERMINAL_STATUSES.has(event.run.status)) close()
    } else if (event.kind === "removed") {
      if (event.runId !== runId) return
      writeEvent(event.kind, event)
      close()
    }
  })

  const unsubscribeChunk = chunkBus
    ? chunkBus.subscribe((event) => {
        if (event.runId !== runId) return
        writeEvent("stream.chunk", event)
      })
    : () => {}

  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`)
    } catch {
      // Ignore write errors on closed sockets.
    }
  }, 25_000)
  ;(ping as unknown as { unref?: () => void }).unref?.()

  res.on("close", () => {
    closed = true
    clearInterval(ping)
    unsubscribeStore()
    unsubscribeChunk()
  })
}

export interface NodeSelfHostServerOptions {
  entryFile: string
  port?: number
  host?: string
  staticDir?: string
  cacheBustEntry?: boolean
  /**
   * Read-only service resolver surfaced to workflow bodies as `ctx.services`.
   *
   * Use this when the loaded entry file registers package workflows that
   * resolve host-provided services, for example
   * `ctx.services.resolve("promotions:bulk-reindex-products")`.
   */
  services?: ServiceResolver
  store?: SnapshotRunStore
  databaseUrl?: string
  wakeupPollIntervalMs?: number
  wakeupLeaseMs?: number
  wakeupLeaseOwner?: string
}

export async function startNodeSelfHostServer(
  opts: NodeSelfHostServerOptions,
): Promise<ServeHandle> {
  const deps = await createNodeSelfHostDeps(opts)
  return startServer(
    {
      port: opts.port ?? 3232,
      host: opts.host ?? "127.0.0.1",
    },
    deps,
  )
}

export async function createNodeSelfHostDeps(
  opts: Pick<
    NodeSelfHostServerOptions,
    | "entryFile"
    | "staticDir"
    | "cacheBustEntry"
    | "services"
    | "store"
    | "databaseUrl"
    | "wakeupPollIntervalMs"
    | "wakeupLeaseMs"
    | "wakeupLeaseOwner"
  >,
): Promise<ServeDeps> {
  let staticDir = opts.staticDir
  if (!staticDir) staticDir = await findDashboardDir(process.cwd())
  if (!staticDir && typeof import.meta.url === "string") {
    const here = resolvePath(new URL(".", import.meta.url).pathname)
    staticDir = await findDashboardDir(here)
  }
  if (staticDir) {
    await assertReadableDirectory(staticDir, "dashboard static dir")
  }

  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL
  const pg = databaseUrl ? createPostgresConnection({ databaseUrl }) : undefined
  const store =
    opts.store ?? (pg ? createPostgresSnapshotRunStore({ db: pg.db }) : createFsSnapshotRunStore())
  const wfMod = (await import("@voyantjs/workflows")) as unknown as {
    __resetRegistry: () => void
    __listRegisteredWorkflows: () => Array<{
      id: string
      config: {
        description?: string
        schedule?: unknown
        timeout?: unknown
      }
    }>
  }
  wfMod.__resetRegistry()

  const entryAbs = resolvePath(process.cwd(), opts.entryFile)
  await assertReadableFile(entryAbs, "workflow entry")
  await loadEntryFile(entryAbs, { cacheBust: opts.cacheBustEntry })

  const _handlerMod = await import("@voyantjs/workflows/handler")
  const rateLimiter = createInMemoryRateLimiter()
  const chunkBus = createChunkBus()

  const nodeStepRunner: StepRunner = async ({ attempt, fn, stepCtx }) => {
    const startedAt = Date.now()
    try {
      const output = await fn(stepCtx)
      return { attempt, status: "ok", output, startedAt, finishedAt: Date.now() }
    } catch (err) {
      const error = err as Error
      const code =
        typeof (err as { code?: unknown }).code === "string"
          ? (err as { code: string }).code
          : "UNKNOWN"
      return {
        attempt,
        status: "err",
        error: {
          category: "USER_ERROR",
          code,
          message: error?.message ?? String(err),
          name: error?.name,
          stack: error?.stack,
        },
        startedAt,
        finishedAt: Date.now(),
      }
    }
  }

  const stepHandler: StepHandler = async (req, stepOpts) =>
    handleStepRequest(req, { rateLimiter, nodeStepRunner, services: opts.services }, stepOpts)
  const tenantMeta = {
    tenantId: "tnt_local",
    projectId: "prj_local",
    organizationId: "org_local",
  }

  const wakeupStore = pg ? createPostgresWakeupStore({ db: pg.db }) : createFsWakeupStore()
  const leaseOwner =
    opts.wakeupLeaseOwner ??
    `node-selfhost-${process.pid}-${Math.random().toString(36).slice(2, 8)}`

  const listWorkflows = () =>
    wfMod.__listRegisteredWorkflows().map((workflow) => ({
      id: workflow.id,
      description: workflow.config.description,
    }))
  const registeredWorkflows = listWorkflows()
  if (registeredWorkflows.length === 0) {
    throw new Error(
      "voyant workflows selfhost: workflow entry registered no workflows. " +
        `Check "${entryAbs}" and ensure it calls workflow(...).`,
    )
  }

  const healthCheck = (): HealthReport => ({
    ok: true,
    service: "voyant-workflows-selfhost",
  })

  const readinessCheck = async (): Promise<HealthReport> => {
    const checks: Record<string, "ok" | "error"> = {
      workflowEntry: "ok",
    }
    const details: Record<string, unknown> = {}

    if (pg) {
      try {
        await pg.pool.query("select 1")
        checks.database = "ok"
      } catch (err) {
        checks.database = "error"
        details.database = err instanceof Error ? err.message : String(err)
      }
    }

    return {
      ok: Object.values(checks).every((status) => status === "ok"),
      service: "voyant-workflows-selfhost",
      checks,
      details: Object.keys(details).length > 0 ? details : undefined,
    }
  }

  const collectMetrics = async (): Promise<string> => {
    const runs = await store.list()
    const wakeups = await wakeupStore.list()
    const runsByStatus = runs.reduce<Record<string, number>>((acc, run) => {
      acc[run.status] = (acc[run.status] ?? 0) + 1
      return acc
    }, {})
    return renderMetrics({
      workflowsRegistered: listWorkflows().length,
      schedulesRegistered: listSchedules ? listSchedules().length : 0,
      runsTotal: runs.length,
      wakeupsTotal: wakeups.length,
      runsByStatus,
      generatedAtMs: Date.now(),
    })
  }

  const wakeupManager = createPersistentWakeupManager({
    wakeupStore,
    listRuns: () => store.list(),
    getRun: (runId) => store.get(runId),
    saveRun: async (stored) => {
      if (!store.update) {
        throw new Error("snapshot run store does not support update")
      }
      return store.update(stored)
    },
    toRecord: (stored) => snapshotToRecord(stored),
    fromRecord: (record, base) => recordToSnapshot(record, base),
    handler: stepHandler,
    onStreamChunk: ({ runId, chunk }) => chunkBus.publish({ runId, chunk }),
    logger: (level, message, data) => {
      const error =
        typeof data === "object" && data !== null && "error" in data ? data.error : undefined
      const details = error ? `: ${String(error)}` : ""
      if (level === "error") console.error(`[voyant] ${message}${details}`)
      else console.warn(`[voyant] ${message}${details}`)
    },
    createRunStore: createInMemoryRunStore,
    resumeDueAlarmsImpl: resumeDueAlarms,
    leaseOwner,
    intervalMs: opts.wakeupPollIntervalMs,
    leaseMs: opts.wakeupLeaseMs,
  })

  const cancelRun: ServeDeps["cancelRun"] = async ({ runId }) => {
    const existing = await store.get(runId)
    if (!existing) return { ok: false, message: `run "${runId}" not found`, exitCode: 1 }
    if (existing.status !== "waiting") {
      return {
        ok: false,
        message: `run "${runId}" is not parked (status: ${existing.status})`,
        exitCode: 2,
      }
    }
    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const now = Date.now()
    const updated: StoredRun = {
      ...existing,
      status: "cancelled",
      completedAt: now,
      durationMs: now - existing.startedAt,
      result: {
        ...existing.result,
        status: "cancelled",
        cancelledAt: now,
      },
    }
    const saved = await store.update(updated)
    await wakeupManager.clear(runId)
    return { ok: true, saved }
  }

  const triggerRun: ServeDeps["triggerRun"] = async ({
    workflowId,
    input,
    runId,
    tags,
    triggeredByUserId,
  }) => {
    const workflow = wfMod.__listRegisteredWorkflows().find((entry) => entry.id === workflowId)
    if (!workflow) {
      return {
        ok: false,
        message: `workflow "${workflowId}" is not registered in ${entryAbs}.`,
        exitCode: 2,
      }
    }
    const nextRunId = runId ?? generateLocalRunId()
    const memStore = createInMemoryRunStore()
    let record: RunRecord
    try {
      record = await trigger(
        {
          runId: nextRunId,
          workflowId,
          workflowVersion: "local",
          input,
          tenantMeta,
          tags,
          triggeredBy:
            triggeredByUserId === undefined || triggeredByUserId === null
              ? { kind: "api" }
              : { kind: "api", actor: triggeredByUserId },
          timeoutMs: durationToMs(workflow.config.timeout),
        },
        {
          store: memStore,
          handler: stepHandler,
          onStreamChunk: (chunk) => chunkBus.publish({ runId: nextRunId, chunk }),
        },
      )
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        exitCode: 1,
      }
    }
    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const stored = recordToSnapshot(record)
    stored.entryFile = entryAbs
    const saved = await store.update(stored)
    await wakeupManager.syncStoredRun(saved)
    return { ok: true, saved }
  }

  const resumeRun: ServeDeps["resumeRun"] = async ({
    parentRunId,
    workflowId: requestedWorkflowId,
    input,
    resumeFromStep,
    seedResults,
    runId,
    tags,
    triggeredByUserId,
  }) => {
    const existing = await store.get(parentRunId)
    let parent: RunRecord | undefined
    if (existing) {
      try {
        parent = snapshotToRecord(existing)
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
          exitCode: 1,
        }
      }
    } else if (!requestedWorkflowId) {
      return {
        ok: false,
        message:
          `parent run "${parentRunId}" not found; pass workflowId, resumeFromStep, ` +
          "and seedResults to resume from an external workflow-runs parent",
        exitCode: 1,
      }
    }

    const workflowId = parent?.workflowId ?? requestedWorkflowId!
    const workflow = wfMod.__listRegisteredWorkflows().find((entry) => entry.id === workflowId)
    if (!workflow) {
      return {
        ok: false,
        message: `workflow "${workflowId}" is not registered in ${entryAbs}.`,
        exitCode: 2,
      }
    }

    let resumeSeed: ReturnType<typeof buildResumeJournal>
    try {
      resumeSeed = parent
        ? buildResumeJournal({
            parent,
            resumeFromStep,
            seedResults,
          })
        : buildSeededResumeJournal({
            parentRunId,
            resumeFromStep: requireExternalResumeFromStep(resumeFromStep),
            seedResults: requireExternalSeedResults(seedResults),
          })
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        exitCode: 2,
      }
    }

    const memStore = createInMemoryRunStore()
    const nextRunId = runId ?? generateLocalRunId()
    let record: RunRecord
    try {
      record = await trigger(
        {
          runId: nextRunId,
          workflowId,
          workflowVersion: parent?.workflowVersion ?? "local",
          input: input === undefined ? parent?.input : input,
          tenantMeta: parent?.tenantMeta ?? tenantMeta,
          environment: parent?.environment,
          triggeredBy:
            triggeredByUserId === undefined || triggeredByUserId === null
              ? { kind: "api" }
              : { kind: "api", actor: triggeredByUserId },
          tags: mergeTags(parent?.tags, [
            "resume:true",
            `parentRunId:${parent?.id ?? parentRunId}`,
            ...(tags ?? []),
          ]),
          timeoutMs: durationToMs(workflow.config.timeout),
          initialJournal: resumeSeed.journal,
        },
        {
          store: memStore,
          handler: stepHandler,
          onStreamChunk: (chunk) => chunkBus.publish({ runId: nextRunId, chunk }),
        },
      )
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        exitCode: 1,
      }
    }

    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const stored = recordToSnapshot(record, {
      entryFile: entryAbs,
      replayOf: parent?.id ?? parentRunId,
    })
    const saved = await store.update(stored)
    await wakeupManager.syncStoredRun(saved)
    return {
      ok: true,
      saved,
      parentRunId: parent?.id ?? parentRunId,
      resumeFromStep: resumeSeed.resumeFromStep,
    }
  }

  const injectWaitpoint: ServeDeps["injectWaitpoint"] = async ({ runId, injection }) => {
    const existing = await store.get(runId)
    if (!existing) {
      return { ok: false, message: `run "${runId}" not found`, exitCode: 1 }
    }
    if (existing.status !== "waiting") {
      return {
        ok: false,
        message: `run "${runId}" is not parked (status: ${existing.status})`,
        exitCode: 2,
      }
    }
    const record = snapshotToRecord(existing)
    if (!record) {
      return { ok: false, message: `run "${runId}" has no resumable snapshot`, exitCode: 1 }
    }
    const memStore = createInMemoryRunStore()
    await memStore.save(record)
    const out = await resume(
      { runId, injection },
      {
        store: memStore,
        handler: stepHandler,
        onStreamChunk: (chunk) => chunkBus.publish({ runId, chunk }),
      },
    )
    if (!out.ok) {
      const exitCode = out.status === "no_match" || out.status === "not_parked" ? 2 : 1
      return { ok: false, message: out.message, exitCode }
    }
    if (!store.update) {
      return { ok: false, message: "snapshot run store does not support update", exitCode: 1 }
    }
    const saved = await store.update(recordToSnapshot(out.record, existing))
    await wakeupManager.syncStoredRun(saved)
    return { ok: true, saved }
  }

  try {
    await wakeupManager.bootstrap()
  } catch (err) {
    console.warn(
      `[voyant] failed to bootstrap wakeup leases from run store: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
  wakeupManager.start()

  let scheduler: SchedulerHandle | undefined
  let listSchedules: ServeDeps["listSchedules"]
  const sources: ScheduleSource[] = []
  for (const workflow of wfMod.__listRegisteredWorkflows()) {
    const decl = workflow.config.schedule
    if (!decl) continue
    const decls = Array.isArray(decl) ? decl : [decl]
    for (const source of decls) {
      sources.push({ workflowId: workflow.id, decl: source })
    }
  }
  if (sources.length > 0) {
    scheduler = createScheduler({
      sources,
      onFire: async ({ workflowId, input }) => {
        await triggerRun({ workflowId, input })
      },
      logger: (level, message) => {
        if (level === "error") console.error(`[scheduler] ${message}`)
        else if (level === "warn") console.warn(`[scheduler] ${message}`)
      },
    })
    listSchedules = () => scheduler!.nextFirings()
  }

  return {
    store,
    createServer,
    healthCheck,
    readinessCheck,
    collectMetrics,
    shutdown: async () => {
      wakeupManager.stop()
      await pg?.close()
    },
    staticDir,
    triggerRun,
    resumeRun,
    listWorkflows,
    injectWaitpoint,
    scheduler,
    listSchedules,
    cancelRun,
    chunkBus,
  }
}

async function assertReadableFile(path: string, label: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(path)
  } catch (err) {
    throw new Error(`voyant workflows selfhost: ${label} not found at "${path}"`, { cause: err })
  }
  if (!info.isFile()) {
    throw new Error(`voyant workflows selfhost: ${label} must be a file (got "${path}")`)
  }
}

async function assertReadableDirectory(path: string, label: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(path)
  } catch (err) {
    throw new Error(`voyant workflows selfhost: ${label} not found at "${path}"`, { cause: err })
  }
  if (!info.isDirectory()) {
    throw new Error(`voyant workflows selfhost: ${label} must be a directory (got "${path}")`)
  }
}

function mergeTags(...groups: ReadonlyArray<ReadonlyArray<string> | undefined>): string[] {
  const tags = new Set<string>()
  for (const group of groups) {
    for (const tag of group ?? []) tags.add(tag)
  }
  return Array.from(tags)
}

function requireExternalResumeFromStep(resumeFromStep: string | undefined): string {
  if (!resumeFromStep) {
    throw new Error(
      "resumeFromStep is required when the parent run is not stored by this self-host server",
    )
  }
  return resumeFromStep
}

function requireExternalSeedResults(
  seedResults: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!seedResults) {
    throw new Error(
      "seedResults is required when the parent run is not stored by this self-host server",
    )
  }
  return seedResults
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function json(status: number, body: unknown): HandlerResponse {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body, null, 2),
  }
}

async function resolveHealthReport(
  check: (() => Promise<HealthReport> | HealthReport) | undefined,
  fallback: HealthReport,
): Promise<HealthReport> {
  if (!check) return fallback
  try {
    return await check()
  } catch (err) {
    return {
      ok: false,
      service: fallback.service,
      checks: {
        ...(fallback.checks ?? {}),
        self: "error",
      },
      details: {
        ...(fallback.details ?? {}),
        error: err instanceof Error ? err.message : String(err),
      },
    }
  }
}

async function resolveMetricsBody(
  collectMetrics: (() => Promise<string> | string) | undefined,
): Promise<string> {
  if (!collectMetrics) {
    return renderMetrics({
      workflowsRegistered: 0,
      schedulesRegistered: 0,
      runsTotal: 0,
      wakeupsTotal: 0,
      runsByStatus: {},
      generatedAtMs: Date.now(),
    })
  }
  try {
    return await collectMetrics()
  } catch (err) {
    return [
      "# HELP voyant_selfhost_metrics_error Metrics collection failure state.",
      "# TYPE voyant_selfhost_metrics_error gauge",
      "voyant_selfhost_metrics_error 1",
      `# metrics_error ${escapeMetricLabelValue(err instanceof Error ? err.message : String(err))}`,
      "",
    ].join("\n")
  }
}

export function renderMetrics(snapshot: MetricsSnapshot): string {
  const lines = [
    "# HELP voyant_selfhost_up Self-host server availability.",
    "# TYPE voyant_selfhost_up gauge",
    "voyant_selfhost_up 1",
    "# HELP voyant_selfhost_workflows_registered Registered workflow count.",
    "# TYPE voyant_selfhost_workflows_registered gauge",
    `voyant_selfhost_workflows_registered ${snapshot.workflowsRegistered}`,
    "# HELP voyant_selfhost_schedules_registered Registered schedule count.",
    "# TYPE voyant_selfhost_schedules_registered gauge",
    `voyant_selfhost_schedules_registered ${snapshot.schedulesRegistered}`,
    "# HELP voyant_selfhost_runs_total Persisted run count.",
    "# TYPE voyant_selfhost_runs_total gauge",
    `voyant_selfhost_runs_total ${snapshot.runsTotal}`,
    "# HELP voyant_selfhost_runs_status Run count by status.",
    "# TYPE voyant_selfhost_runs_status gauge",
  ]
  for (const [status, count] of Object.entries(snapshot.runsByStatus).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`voyant_selfhost_runs_status{status="${escapeMetricLabelValue(status)}"} ${count}`)
  }
  lines.push(
    "# HELP voyant_selfhost_wakeups_total Persisted wakeup count.",
    "# TYPE voyant_selfhost_wakeups_total gauge",
    `voyant_selfhost_wakeups_total ${snapshot.wakeupsTotal}`,
    "# HELP voyant_selfhost_metrics_generated_at_seconds Metrics generation timestamp.",
    "# TYPE voyant_selfhost_metrics_generated_at_seconds gauge",
    `voyant_selfhost_metrics_generated_at_seconds ${Math.floor(snapshot.generatedAtMs / 1000)}`,
    "",
  )
  return lines.join("\n")
}

function escapeMetricLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
}

function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase()
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".svg":
      return "image/svg+xml"
    case ".png":
      return "image/png"
    case ".map":
      return "application/json"
    default:
      return "application/octet-stream"
  }
}

function urlPath(raw: string): string {
  try {
    return new URL(raw, "http://local").pathname
  } catch {
    return raw
  }
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const maxBytes = 1_000_000
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks: Uint8Array[] = []
    req.on("data", (chunk: Uint8Array) => {
      total += chunk.length
      if (total > maxBytes) {
        req.destroy(new Error("request body exceeds 1MB"))
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
    req.on("error", reject)
  })
}
