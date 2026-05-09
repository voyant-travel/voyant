// Public HTTP surface of the Cloudflare orchestrator. The outer
// Worker receives a request, resolves the run DO by id (or creates
// one for a new trigger), and forwards to the DO. This layer owns
// only routing + auth; the state machine lives in the DO.
//
// Routes (all JSON bodies):
//   POST /api/runs                     → trigger a run
//   GET  /api/runs/:id                 → fetch a run
//   POST /api/runs/:id/signals         → inject a SIGNAL waitpoint
//   POST /api/runs/:id/events          → inject an EVENT waitpoint
//   POST /api/runs/:id/tokens/:token   → inject a MANUAL (token) waitpoint
//   POST /api/runs/:id/cancel          → cancel a run

import type { WaitpointInjection } from "@voyantjs/workflows-orchestrator"

import { handleIngestEvent } from "./event-handler.js"
import { handleGetManifest, handleRegisterManifest } from "./manifest-handler.js"
import type { CfManifestStore } from "./manifest-kv-store.js"

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
   * `/api/manifests` and `/api/events`. When unset, those routes 404 —
   * useful for orchestrators that only expose the run surface.
   */
  manifestStore?: CfManifestStore
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
    const forward = new Request(`https://do-internal/trigger`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, runId }),
    })
    return forwardToRunDO(runId, forward, deps)
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
    return JSON.parse(text) as Record<string, unknown>
  } catch (err) {
    return { error: "invalid_json", message: errMsg(err) }
  }
}

function corsHeaders(methods: string): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": methods,
    "access-control-allow-headers": "content-type, x-voyant-protocol",
  }
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
