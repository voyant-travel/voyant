// HTTP handler for `POST /api/events` — the synchronous event-ingest
// endpoint. Loads the registered manifest from KV, runs the pure
// `routeEvent` from `@voyantjs/workflows-orchestrator`, and forwards
// each match into the existing `/trigger` DO surface with a derived
// idempotencyKey.
//
// Response shape mirrors `IngestEventResponse` from
// `@voyantjs/workflows/driver`:
//
//   { ok: true,  eventId, matches: [...] }
//   { ok: false, reason: "manifest_not_registered" | ... }
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §15.

import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import { routeEvent } from "@voyantjs/workflows-orchestrator"

import type { CfManifestStore } from "./manifest-kv-store.js"
import type { DurableObjectNamespaceLike } from "./worker.js"

const ALLOWED_ENVS = new Set(["production", "preview", "development"])

export interface EventHandlerDeps<Id = unknown> {
  /** KV-backed manifest store (read-only path here). */
  manifestStore: CfManifestStore
  /** DO namespace used to forward each match to the run DO. */
  runDO: DurableObjectNamespaceLike<Id>
  /** id generator for new triggers; defaults to `run_<random>`. */
  idGenerator?: () => string
  /** Injectable clock. */
  now?: () => number
  /** Tenant metadata stamped on every triggered run. */
  tenantMeta?: {
    tenantId: string
    projectId: string
    organizationId: string
    tenantScript?: string
  }
  /** Optional logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
}

const DEFAULT_TENANT_META = {
  tenantId: "default",
  projectId: "default",
  organizationId: "default",
}

interface IngestEnvelope {
  name: string
  data: unknown
  metadata?: Record<string, unknown> & { eventId?: string }
  emittedAt: string
}

interface IngestRequestBody {
  environment: string
  envelope: IngestEnvelope
  idempotencyKey?: string
}

export async function handleIngestEvent<Id>(
  req: Request,
  deps: EventHandlerDeps<Id>,
): Promise<Response> {
  // Body parse + validate.
  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    return json(400, {
      error: "invalid_json",
      message: err instanceof Error ? err.message : String(err),
    })
  }
  const validation = validateBody(raw)
  if (!validation.ok) return json(400, validation.error)
  const body = validation.body

  // Manifest lookup.
  const manifestEnvelope = await deps.manifestStore.getCurrent(body.environment)
  if (!manifestEnvelope) {
    return json(200, {
      ok: false,
      reason: "manifest_not_registered",
      message: `No manifest is registered for environment "${body.environment}".`,
    })
  }
  const manifest = manifestEnvelope.manifest as unknown as WorkflowManifest

  // Event id derivation — use the caller-stamped one when present, fall
  // back to a content-derived id so external callers without a forwarder
  // still get sensible idempotency.
  const now = deps.now ?? (() => Date.now())
  const eventId = body.envelope.metadata?.eventId ?? deriveEventIdFallback(body.envelope, now)

  // Route through the manifest's filters.
  const routed = routeEvent({
    manifest,
    envelope: {
      name: body.envelope.name,
      data: body.envelope.data,
      metadata: body.envelope.metadata,
      emittedAt: body.envelope.emittedAt,
    },
    eventId,
    idempotencyOverride: body.idempotencyKey,
  })

  // Forward each match into the existing /trigger DO route.
  const matches: unknown[] = []
  let anyTriggered = false
  let anyFailed = false
  const tenantMeta = deps.tenantMeta ?? DEFAULT_TENANT_META

  for (const entry of routed) {
    if (entry.status === "skipped") {
      matches.push({
        filterId: entry.filterId,
        status: "skipped",
        reason: entry.reason,
        details: entry.details,
      })
      continue
    }

    const runId = `idem-${entry.targetWorkflowId}-${entry.idempotencyKey}`
    const triggerPayload = {
      runId,
      workflowId: entry.targetWorkflowId,
      workflowVersion: "v1",
      input: entry.input,
      tenantMeta,
      environment: body.environment,
      idempotencyKey: entry.idempotencyKey,
      triggeredBy: {
        kind: "event" as const,
        eventId,
        eventType: body.envelope.name,
        filterId: entry.filterId,
      },
    }

    try {
      const forward = new Request("https://do-internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(triggerPayload),
      })
      const id = deps.runDO.idFromName(runId)
      const stub = deps.runDO.get(id)
      const resp = await stub.fetch(forward)
      if (resp.status >= 200 && resp.status < 300) {
        matches.push({
          filterId: entry.filterId,
          targetWorkflowId: entry.targetWorkflowId,
          runId,
          idempotencyKey: entry.idempotencyKey,
          status: "queued",
        })
        anyTriggered = true
      } else {
        const errBody = await safeReadText(resp)
        deps.logger?.("error", "trigger DO failed", {
          status: resp.status,
          body: errBody.slice(0, 256),
        })
        matches.push({
          filterId: entry.filterId,
          targetWorkflowId: entry.targetWorkflowId,
          status: "error",
          reason: `do_returned_${resp.status}`,
        })
        anyFailed = true
      }
    } catch (err) {
      deps.logger?.("error", "trigger forward threw", {
        error: err instanceof Error ? err.message : String(err),
      })
      matches.push({
        filterId: entry.filterId,
        targetWorkflowId: entry.targetWorkflowId,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      })
      anyFailed = true
    }
  }

  if (matches.length > 0 && !anyTriggered && anyFailed) {
    return json(502, {
      ok: false,
      reason: "trigger_failed_for_all_matches",
      message: "every matched filter failed to trigger",
    })
  }

  return json(200, { ok: true, eventId, matches })
}

// ---- Validation ----

function validateBody(
  raw: unknown,
):
  | { ok: true; body: IngestRequestBody }
  | { ok: false; error: { error: string; message: string } } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: { error: "invalid_body", message: "expected JSON object" } }
  }
  const r = raw as Record<string, unknown>

  if (typeof r.environment !== "string" || !ALLOWED_ENVS.has(r.environment)) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: `"environment" must be one of ${[...ALLOWED_ENVS].join(", ")}`,
      },
    }
  }
  if (typeof r.envelope !== "object" || r.envelope === null) {
    return {
      ok: false,
      error: { error: "invalid_body", message: '"envelope" must be an object' },
    }
  }
  const envelope = r.envelope as Record<string, unknown>
  if (typeof envelope.name !== "string" || envelope.name.length === 0) {
    return {
      ok: false,
      error: { error: "invalid_body", message: '"envelope.name" must be a non-empty string' },
    }
  }
  if (typeof envelope.emittedAt !== "string" || envelope.emittedAt.length === 0) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: '"envelope.emittedAt" must be an ISO timestamp string',
      },
    }
  }
  if (
    envelope.metadata !== undefined &&
    (typeof envelope.metadata !== "object" || envelope.metadata === null)
  ) {
    return {
      ok: false,
      error: {
        error: "invalid_body",
        message: '"envelope.metadata" must be an object when supplied',
      },
    }
  }
  if (r.idempotencyKey !== undefined && typeof r.idempotencyKey !== "string") {
    return {
      ok: false,
      error: { error: "invalid_body", message: '"idempotencyKey" must be a string when supplied' },
    }
  }
  return {
    ok: true,
    body: {
      environment: r.environment,
      envelope: {
        name: envelope.name,
        data: envelope.data,
        metadata: envelope.metadata as Record<string, unknown> | undefined,
        emittedAt: envelope.emittedAt,
      },
      idempotencyKey: r.idempotencyKey as string | undefined,
    },
  }
}

// ---- Internal helpers ----

function deriveEventIdFallback(envelope: IngestEnvelope, now: () => number): string {
  // Best-effort fallback when caller didn't supply metadata.eventId.
  // Same shape as the in-process driver's ensureEventId. The forwarder in
  // PR4 always stamps a ULID upstream so this path is mostly external.
  return `evt_${now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text()
  } catch {
    return ""
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, x-voyant-protocol",
    },
  })
}
