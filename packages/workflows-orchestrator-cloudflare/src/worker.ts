// Public HTTP surface of the Cloudflare orchestrator. The outer
// Worker receives a request, resolves the run DO by id (or creates
// one for a new trigger), and forwards to the DO. This layer owns
// only routing + auth; the state machine lives in the DO.
//
// Routes (all JSON bodies):
//   POST /api/runs                     → trigger a run
//   GET  /api/runs/:id                 → fetch a run
//   POST /api/runs/:id/resume          → start a new run from a failed parent step
//   POST /api/runs/:id/signals         → inject a SIGNAL waitpoint
//   POST /api/runs/:id/events          → inject an EVENT waitpoint
//   POST /api/runs/:id/tokens/:token   → inject a MANUAL (token) waitpoint
//   POST /api/runs/:id/cancel          → cancel a run

import {
  buildResumeJournal,
  buildSeededResumeJournal,
  type RunRecord,
  type WaitpointInjection,
} from "@voyantjs/workflows-orchestrator"

import { handleIngestEvent } from "./event-handler.js"
import { handleGetManifest, handleRegisterManifest } from "./manifest-handler.js"
import type { CfManifestStore } from "./manifest-kv-store.js"
import { handleGetSchedules } from "./schedule-handler.js"
import type { CfScheduleStateStore } from "./schedule-state-store.js"

const DEFAULT_TENANT_META = {
  tenantId: "default",
  projectId: "default",
  organizationId: "default",
}

/**
 * Minimal shape of a DO namespace. `idFromName` returns an opaque id;
 * `get(id)` returns a stub with `fetch` (matching the CF DO API).
 * Typed loosely so tests can pass any matching object.
 */
export interface DurableObjectNamespaceLike<Id = unknown> {
  idFromName(name: string): Id
  get(id: Id): { fetch(req: Request): Promise<Response> }
}

export interface WorkerFetchDeps<Id = unknown> {
  runDO: DurableObjectNamespaceLike<Id>
  /**
   * Called before any routing. Throws/rejects to reject the request.
   * Typical implementation validates a tenant access token.
   */
  verifyRequest?: (req: Request) => void | Promise<void>
  /** Optional logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
  /** id generator for new triggers; defaults to `run_<random>`. */
  idGenerator?: () => string
  /** Injectable clock for id generation. */
  now?: () => number
  /**
   * Optional KV-backed manifest store. When set, the worker also serves
   * `/api/manifests`, `/api/schedules`, and `/api/events`. When unset,
   * those routes 404 — useful for orchestrators that only expose the
   * run surface.
   */
  manifestStore?: CfManifestStore
  /**
   * Optional process-wide schedules toggle reported by
   * `/api/schedules/:env`. Used by the workflow-schedules UI to show
   * "schedules disabled by env flag" when the orchestrator is running
   * with `VOYANT_WORKFLOWS_ENABLE_SCHEDULES` (or equivalent) turned off.
   * When omitted, the schedules response leaves the flag out.
   */
  schedulesEnabledByEnv?: boolean
  /**
   * Optional persisted scheduler execution state read by
   * `/api/schedules/:env`.
   */
  scheduleStateStore?: CfScheduleStateStore
  /**
   * Tenant metadata stamped on event-triggered runs. Defaults to
   * `{ tenantId: "default", projectId: "default", organizationId: "default" }`.
   * Voyant Cloud's wrapper layer overrides this with per-org values via
   * the request-routing layer.
   */
  tenantMeta?: {
    tenantId: string
    projectId: string
    organizationId: string
    tenantScript?: string
  }
}

export async function handleWorkerRequest<Id>(
  req: Request,
  deps: WorkerFetchDeps<Id>,
): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders("GET,POST,OPTIONS"),
    })
  }

  try {
    if (deps.verifyRequest) await deps.verifyRequest(req)
  } catch (err) {
    return json(401, {
      error: "unauthorized",
      message: err instanceof Error ? err.message : String(err),
    })
  }

  // POST /api/manifests — register a manifest for an environment.
  if (req.method === "POST" && url.pathname === "/api/manifests") {
    if (!deps.manifestStore) {
      return json(404, { error: "manifests_not_configured" })
    }
    return handleRegisterManifest(req, {
      manifestStore: deps.manifestStore,
      logger: deps.logger,
    })
  }

  // GET /api/manifests/:env — read the current manifest.
  if (req.method === "GET") {
    const manifestMatch = url.pathname.match(/^\/api\/manifests\/([^/]+)$/)
    if (manifestMatch) {
      if (!deps.manifestStore) {
        return json(404, { error: "manifests_not_configured" })
      }
      const env = decodeURIComponent(manifestMatch[1] ?? "")
      return handleGetManifest(env, {
        manifestStore: deps.manifestStore,
        logger: deps.logger,
      })
    }

    // GET /api/schedules/:env — aggregate scheduled-workflow view.
    const schedulesMatch = url.pathname.match(/^\/api\/schedules\/([^/]+)$/)
    if (schedulesMatch) {
      if (!deps.manifestStore) {
        return json(404, { error: "schedules_not_configured" })
      }
      const env = decodeURIComponent(schedulesMatch[1] ?? "")
      return handleGetSchedules(env, {
        manifestStore: deps.manifestStore,
        schedulesEnabledByEnv: deps.schedulesEnabledByEnv,
        scheduleStateStore: deps.scheduleStateStore,
        now: deps.now,
        logger: deps.logger,
      })
    }
  }

  // POST /api/events — synchronous event ingest. Loads the manifest,
  // routes filters, forwards each match to the run-DO trigger flow.
  if (req.method === "POST" && url.pathname === "/api/events") {
    if (!deps.manifestStore) {
      return json(404, { error: "events_not_configured" })
    }
    return handleIngestEvent(req, {
      manifestStore: deps.manifestStore,
      runDO: deps.runDO,
      idGenerator: deps.idGenerator,
      now: deps.now,
      tenantMeta: deps.tenantMeta,
      logger: deps.logger,
    })
  }

  // POST /api/runs — trigger a new run.
  if (req.method === "POST" && url.pathname === "/api/runs") {
    let payload: Record<string, unknown>
    try {
      payload = (await req.json()) as Record<string, unknown>
    } catch (err) {
      return json(400, { error: "invalid_json", message: errMsg(err) })
    }
    const runId = typeof payload.runId === "string" ? payload.runId : defaultRunId(deps)
    const publicPayload = sanitizePublicTriggerPayload(payload)
    const forward = new Request(`https://do-internal/trigger`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...publicPayload, runId }),
    })
    const fireAt = deps.now ? deps.now() : Date.now()
    const scheduleTrigger = getScheduleTrigger(publicPayload)
    try {
      const triggerRes = await forwardToRunDO(runId, forward, deps)
      const runResult = triggerRes.ok ? await safeResponseJson(triggerRes.clone()) : undefined
      const runError = triggerRes.ok
        ? failedRunError(runResult)
        : `do_returned_${triggerRes.status}`
      await recordScheduleDispatch(deps, {
        scheduleTrigger,
        runId: triggerRes.ok ? runId : null,
        fireAt,
        error: runError,
        lastSuccessfulRunAt: completedRunAt(runResult),
      })
      return triggerRes
    } catch (err) {
      await recordScheduleDispatch(deps, {
        scheduleTrigger,
        runId: null,
        fireAt,
        error: errMsg(err),
      })
      throw err
    }
  }

  // Everything below operates on a specific runId.
  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(\/.+)?$/)
  if (!runMatch) {
    return json(404, { error: "route_not_found", path: url.pathname })
  }
  const runId = decodeURIComponent(runMatch[1]!)
  const tail = runMatch[2] ?? ""

  if (req.method === "GET" && tail === "") {
    const forward = new Request(`https://do-internal/get`, { method: "GET" })
    return forwardToRunDO(runId, forward, deps)
  }

  if (req.method === "POST" && tail === "/cancel") {
    const body = await safeJson(req)
    if (isErrorBody(body)) return json(400, body)
    return forwardToRunDO(
      runId,
      new Request(`https://do-internal/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      deps,
    )
  }

  if (req.method === "POST" && tail === "/resume") {
    const body = await safeJson(req)
    if (isErrorBody(body)) return json(400, body)
    const parsed = parseResumeRunBody(body)
    if ("error" in parsed) return json(400, parsed)

    const parent = await fetchRunRecord(runId, deps)
    if ("error" in parent) return parent.error

    const workflowId = parsed.body.workflowId ?? parent.record?.workflowId
    if (!workflowId) {
      return json(404, {
        error: "resume_failed",
        message:
          `parent run "${runId}" not found; pass workflowId, resumeFromStep, ` +
          "and seedResults to resume from an external workflow-runs parent",
      })
    }

    let resumeSeed: ReturnType<typeof buildResumeJournal>
    try {
      resumeSeed = parent.record
        ? buildResumeJournal({
            parent: parent.record,
            resumeFromStep: parsed.body.resumeFromStep,
            seedResults: parsed.body.seedResults,
            now: deps.now,
          })
        : buildSeededResumeJournal({
            parentRunId: runId,
            resumeFromStep: requireExternalResumeFromStep(parsed.body.resumeFromStep),
            seedResults: requireExternalSeedResults(parsed.body.seedResults),
            now: deps.now,
          })
    } catch (err) {
      return json(400, { error: "resume_failed", message: errMsg(err) })
    }

    const nextRunId = parsed.body.runId ?? defaultRunId(deps)
    const triggerRes = await forwardToRunDO(
      nextRunId,
      new Request("https://do-internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId,
          workflowVersion: parent.record?.workflowVersion ?? "local",
          input: parsed.body.hasInput ? parsed.body.input : parent.record?.input,
          tenantMeta: parent.record?.tenantMeta ?? deps.tenantMeta ?? DEFAULT_TENANT_META,
          environment: parent.record?.environment,
          tags: mergeTags(parent.record?.tags, [
            "resume:true",
            `parentRunId:${parent.record?.id ?? runId}`,
            ...(parsed.body.tags ?? []),
          ]),
          runId: nextRunId,
          triggeredBy:
            parsed.body.triggeredByUserId === undefined || parsed.body.triggeredByUserId === null
              ? { kind: "api" }
              : { kind: "api", actor: parsed.body.triggeredByUserId },
          timeoutMs: parent.record?.timeoutMs,
          initialJournal: resumeSeed.journal,
          initialMetadataAppliedCount: resumeSeed.metadataAppliedCount,
        }),
      }),
      deps,
    )
    if (!triggerRes.ok) return triggerRes
    const saved = (await triggerRes.json()) as RunRecord
    return json(200, {
      saved,
      parentRunId: parent.record?.id ?? runId,
      resumeFromStep: resumeSeed.resumeFromStep,
    })
  }

  // Waitpoint injections: events, signals, tokens.
  const body = await safeJson(req)
  if (isErrorBody(body)) return json(400, body)
  const injection = parseInjection(tail, body)
  if ("error" in injection) return json(400, injection)
  return forwardToRunDO(
    runId,
    new Request(`https://do-internal/resume`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ injection: injection.injection }),
    }),
    deps,
  )
}

function isErrorBody(
  body: Record<string, unknown> | { error: string; message: string },
): body is { error: string; message: string } {
  return typeof (body as { error?: unknown }).error === "string"
}

function parseInjection(
  tail: string,
  body: Record<string, unknown>,
): { injection: WaitpointInjection } | { error: string; message: string } {
  if (tail === "/events") {
    if (typeof body.eventType !== "string" || body.eventType.length === 0) {
      return { error: "invalid_body", message: "`eventType` (string) is required" }
    }
    return {
      injection: { kind: "EVENT", eventType: body.eventType, payload: body.payload },
    }
  }
  if (tail === "/signals") {
    if (typeof body.name !== "string" || body.name.length === 0) {
      return { error: "invalid_body", message: "`name` (string) is required" }
    }
    return { injection: { kind: "SIGNAL", name: body.name, payload: body.payload } }
  }
  const tokenMatch = tail.match(/^\/tokens\/([^/]+)$/)
  if (tokenMatch) {
    return {
      injection: {
        kind: "MANUAL",
        tokenId: decodeURIComponent(tokenMatch[1]!),
        payload: body.payload,
      },
    }
  }
  return { error: "route_not_found", message: `unknown path suffix ${tail}` }
}

function parseResumeRunBody(body: Record<string, unknown>):
  | {
      body: {
        hasInput: boolean
        input?: unknown
        workflowId?: string
        resumeFromStep?: string
        seedResults?: Record<string, unknown>
        runId?: string
        tags?: string[]
        triggeredByUserId?: string | null
      }
    }
  | { error: string; message: string } {
  if (!isPlainObject(body)) {
    return { error: "invalid_body", message: "request body must be an object" }
  }
  if (body.resumeFromStep !== undefined && typeof body.resumeFromStep !== "string") {
    return { error: "invalid_body", message: "`resumeFromStep` must be a string when provided" }
  }
  if (body.workflowId !== undefined && typeof body.workflowId !== "string") {
    return { error: "invalid_body", message: "`workflowId` must be a string when provided" }
  }
  if (body.runId !== undefined && typeof body.runId !== "string") {
    return { error: "invalid_body", message: "`runId` must be a string when provided" }
  }
  if (
    body.triggeredByUserId !== undefined &&
    body.triggeredByUserId !== null &&
    typeof body.triggeredByUserId !== "string"
  ) {
    return {
      error: "invalid_body",
      message: "`triggeredByUserId` must be a string or null when provided",
    }
  }
  if (body.tags !== undefined && !isStringArray(body.tags)) {
    return { error: "invalid_body", message: "`tags` must be an array of strings when provided" }
  }
  if (body.seedResults !== undefined && !isPlainObject(body.seedResults)) {
    return { error: "invalid_body", message: "`seedResults` must be an object when provided" }
  }
  return {
    body: {
      hasInput: Object.hasOwn(body, "input"),
      input: body.input,
      workflowId: body.workflowId,
      resumeFromStep: body.resumeFromStep,
      seedResults: body.seedResults as Record<string, unknown> | undefined,
      runId: body.runId,
      tags: body.tags as string[] | undefined,
      triggeredByUserId: body.triggeredByUserId as string | null | undefined,
    },
  }
}

async function fetchRunRecord<Id>(
  runId: string,
  deps: WorkerFetchDeps<Id>,
): Promise<{ record?: RunRecord } | { error: Response }> {
  const res = await forwardToRunDO(
    runId,
    new Request("https://do-internal/get", { method: "GET" }),
    deps,
  )
  if (res.status === 404) {
    return {}
  }
  if (!res.ok) return { error: res }
  return { record: (await res.json()) as RunRecord }
}

async function forwardToRunDO<Id>(
  runId: string,
  req: Request,
  deps: WorkerFetchDeps<Id>,
): Promise<Response> {
  const id = deps.runDO.idFromName(runId)
  const stub = deps.runDO.get(id)
  const resp = await stub.fetch(req)
  // Add CORS on outbound responses.
  const out = new Response(resp.body, resp)
  for (const [k, v] of Object.entries(corsHeaders("GET,POST,OPTIONS"))) {
    out.headers.set(k, v)
  }
  return out
}

function defaultRunId<Id>(deps: WorkerFetchDeps<Id>): string {
  if (deps.idGenerator) return deps.idGenerator()
  const now = deps.now ?? (() => Date.now())
  const ts = now().toString(36)
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(4, "0")
  return `run_${ts}_${rand}`
}

async function safeJson(
  req: Request,
): Promise<Record<string, unknown> | { error: string; message: string }> {
  // Some requests are bodyless (GET). Only parse when we have a body.
  if (req.method === "GET" || req.method === "HEAD") return {}
  const text = await req.text()
  if (text.length === 0) return {}
  try {
    const parsed = JSON.parse(text) as unknown
    if (!isPlainObject(parsed)) {
      return { error: "invalid_body", message: "request body must be an object" }
    }
    return parsed
  } catch (err) {
    return { error: "invalid_json", message: errMsg(err) }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
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
    throw new Error("resumeFromStep is required when the parent run is not stored by this worker")
  }
  return resumeFromStep
}

function requireExternalSeedResults(
  seedResults: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!seedResults) {
    throw new Error("seedResults is required when the parent run is not stored by this worker")
  }
  return seedResults
}

function corsHeaders(methods: string): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": methods,
    "access-control-allow-headers": "content-type, x-voyant-protocol",
  }
}

function sanitizePublicTriggerPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const {
    initialJournal: _initialJournal,
    initialMetadataAppliedCount: _initialMetadataAppliedCount,
    timeoutMs: _timeoutMs,
    ...publicPayload
  } = payload
  return publicPayload
}

function getScheduleTrigger(payload: Record<string, unknown>): {
  environment: "production" | "preview" | "development"
  scheduleId: string
} | null {
  const triggeredBy = payload.triggeredBy
  const environment = payload.environment ?? "development"
  if (
    typeof triggeredBy !== "object" ||
    triggeredBy === null ||
    !("kind" in triggeredBy) ||
    triggeredBy.kind !== "schedule" ||
    !("scheduleId" in triggeredBy) ||
    typeof triggeredBy.scheduleId !== "string" ||
    triggeredBy.scheduleId.length === 0 ||
    (environment !== "production" && environment !== "preview" && environment !== "development")
  ) {
    return null
  }
  return {
    environment,
    scheduleId: triggeredBy.scheduleId,
  }
}

async function recordScheduleDispatch<Id>(
  deps: WorkerFetchDeps<Id>,
  args: {
    scheduleTrigger: ReturnType<typeof getScheduleTrigger>
    runId: string | null
    fireAt: number
    error: string | null
    lastSuccessfulRunAt?: number
  },
): Promise<void> {
  if (!deps.scheduleStateStore || !args.scheduleTrigger) return
  try {
    const existing = (
      await deps.scheduleStateStore.getStates(args.scheduleTrigger.environment, [
        args.scheduleTrigger.scheduleId,
      ])
    ).get(args.scheduleTrigger.scheduleId)
    await deps.scheduleStateStore.putState(args.scheduleTrigger.environment, {
      ...existing,
      scheduleId: args.scheduleTrigger.scheduleId,
      environment: args.scheduleTrigger.environment,
      lastFireAt: args.fireAt,
      lastRunId: args.runId,
      lastError: args.error,
      ...(args.lastSuccessfulRunAt !== undefined
        ? { lastSuccessfulRunAt: args.lastSuccessfulRunAt }
        : {}),
      updatedAt: deps.now ? deps.now() : Date.now(),
    })
  } catch (err) {
    deps.logger?.("warn", "schedules: cannot persist scheduler dispatch state", {
      environment: args.scheduleTrigger.environment,
      scheduleId: args.scheduleTrigger.scheduleId,
      error: errMsg(err),
    })
  }
}

async function safeResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function completedRunAt(value: unknown): number | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "completed" &&
    "completedAt" in value &&
    typeof value.completedAt === "number" &&
    Number.isFinite(value.completedAt)
  ) {
    return value.completedAt
  }
  return undefined
}

function failedRunError(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("status" in value)) return null
  const status = value.status
  if (status !== "failed" && status !== "compensation_failed") return null
  const error = "error" in value ? value.error : undefined
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message
  }
  return `run_${status}`
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders("GET,POST,OPTIONS"),
    },
  })
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
