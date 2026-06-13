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

import { deriveStableEventId } from "@voyantjs/workflows/events"
import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import { routeEvent } from "@voyantjs/workflows-orchestrator"

import type { CfManifestStore } from "./manifest-kv-store.js"
import type { DurableObjectNamespaceLike } from "./worker.js"

const ALLOWED_ENVS = new Set(["production", "preview", "development"])

function deserializeWorkflowManifest(manifest: Record<string, unknown>): WorkflowManifest {
  const {
    schemaVersion,
    projectId,
    versionId,
    builtAt,
    builderVersion,
    capabilities,
    workflows,
    eventFilters,
    diagnostics,
    bindings,
    environments,
  } = manifest
  const normalizedCapabilities = normalizeManifestCapabilities(capabilities)

  if (
    schemaVersion !== 1 ||
    typeof projectId !== "string" ||
    typeof versionId !== "string" ||
    typeof builtAt !== "number" ||
    typeof builderVersion !== "string" ||
    !normalizedCapabilities ||
    !Array.isArray(workflows) ||
    !Array.isArray(eventFilters) ||
    !isRecord(bindings) ||
    !isRecord(environments)
  ) {
    throw new Error("stored workflow manifest has an invalid shape")
  }

  return {
    schemaVersion,
    projectId,
    versionId,
    builtAt,
    builderVersion,
    capabilities: normalizedCapabilities,
    workflows: workflows as WorkflowManifest["workflows"],
    eventFilters: eventFilters as WorkflowManifest["eventFilters"],
    diagnostics: Array.isArray(diagnostics) ? (diagnostics as WorkflowManifest["diagnostics"]) : [],
    bindings: bindings as WorkflowManifest["bindings"],
    environments: environments as WorkflowManifest["environments"],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeManifestCapabilities(
  value: unknown,
): WorkflowManifest["capabilities"] | undefined {
  if (isRecord(value)) {
    return {
      trigger: value.trigger === true,
      events: value.events === true,
      schedules: value.schedules === true,
      rerun: value.rerun === true,
      resume: value.resume === true,
      cancel: value.cancel === true,
      humanApproval: value.humanApproval === true,
      stepRerun: value.stepRerun === true,
    }
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    const legacy = new Set(value)
    return {
      trigger: legacy.has("trigger"),
      events: legacy.has("events") || legacy.has("events:v1"),
      schedules: legacy.has("schedules"),
      rerun: legacy.has("rerun"),
      resume: legacy.has("resume"),
      cancel: legacy.has("cancel"),
      humanApproval: legacy.has("human-approval"),
      stepRerun: legacy.has("step-rerun"),
    }
  }
  return undefined
}

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
  const manifest = deserializeWorkflowManifest(manifestEnvelope.manifest)

  // Event id derivation — use the caller-stamped one when present, fall
  // back to a content-derived id so external callers without a forwarder
  // still get sensible idempotency.
  const eventId = body.envelope.metadata?.eventId ?? (await deriveStableEventId(body.envelope))

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

// Fallback id derivation lives in `@voyantjs/workflows/events`'s
// `deriveStableEventId` and is used inline above — content-derived so
// external callers (HTTP retries, third-party webhooks) dedupe naturally
// across re-deliveries (architecture doc §15.2).

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
