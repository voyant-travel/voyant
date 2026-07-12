/**
 * Hono routes for the workflow-runs admin surface.
 *
 *   GET  /v1/admin/workflow-runs          → list (filter by workflow / status / tag)
 *   GET  /v1/admin/workflow-runs/:id      → run + ordered steps
 *   POST /v1/admin/workflows/:name/runs   → trigger registered workflow by name
 *   POST /v1/admin/workflow-runs/:id/rerun  → fresh run with the recorded input
 *   POST /v1/admin/workflow-runs/:id/resume → re-run starting at the failed step
 *
 * Templates mount via `mountWorkflowRunsAdminRoutes(hono, opts)` —
 * the routes are attached directly to the supplied Hono instance so
 * they inherit the parent's middleware (auth + db). The optional
 * `runners` registry is consulted for rerun/resume; if it's not
 * provided (or doesn't have a runner for the workflow), those
 * endpoints return 501 with a clear error.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * workflow-runs batch). The legs are authored as `createRoute(...).openapi(...)`
 * on an internal `OpenAPIHono` child (carrying the shared `openApiValidationHook`),
 * then composed onto the supplied mount target via `.route("/", child)` so the
 * `.openapi()` operations propagate to the composed app's registry and surface
 * in the operator spec. The mount target is structural (`{ route }` only) so an
 * `OpenAPIHono` parent — the `additionalRoutes(hono)` app the starters pass — is
 * assignable without a cast or caller change.
 *
 * The trigger/rerun bodies and the list query keep their verbatim in-handler
 * parsing + typed-error shaping (idempotency confirmation, scope checks, custom
 * `invalid_query`/`invalid_body` envelopes), so those legs declare no OpenAPI
 * request schema — only path params + the per-status response unions. Handlers
 * return bare `Response`s, bridged to the inferred typed-response union via
 * `asRouteResponse`. Response row schemas are authored here from the Drizzle
 * `$inferSelect` shapes (§17: timestamps → ISO strings; jsonb input/result/error
 * → open records). Business logic is unchanged.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { handleApiError, openApiValidationHook, parseJsonBody } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { Context, Hono } from "hono"

import type { WorkflowRunnerRegistry } from "./runner.js"
import { workflowRunsService } from "./service.js"

/**
 * Structural mount target — just the `.route()` surface this function uses.
 * Decoupled from Hono's full generic signature so deployments can pass an
 * `OpenAPIHono` parent (the `additionalRoutes(hono)` app) WITHOUT a cast — which
 * is what makes the mounted `.openapi()` child surface in the build-time OpenAPI
 * spec (voyant#2114).
 */
export interface WorkflowRunsMountTarget {
  // biome-ignore lint/suspicious/noExplicitAny: intentional — accept any Env-typed sub-app; the mount only composes routes (voyant#2114)
  route(path: string, app: Hono<any, any, any>): unknown
}

/**
 * Bridges a handler's bare `Response` (and Date-bearing Drizzle rows whose wire
 * shape is the declared `z.string()` timestamp) to the `.openapi()` per-route
 * inferred typed-response union. Runtime payloads honor the declared schemas
 * (asserted by the contract tests); this only relaxes the compile-time check.
 */
// biome-ignore lint/suspicious/noExplicitAny: intentional — bridges bare Response to the inferred typed-response union (voyant#2114)
function asRouteResponse(response: Promise<Response>): Promise<any> {
  return response
}

const listQuerySchema = z.object({
  workflowName: z.string().min(1).optional(),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]).optional(),
  tag: z.string().min(1).optional(),
  parentRunId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const rerunBodySchema = z.object({
  /** Required when runner.idempotency === "unsafe". */
  confirm: z.boolean().optional(),
})

const triggerWorkflowBodySchema = z
  .object({
    input: z.unknown().optional(),
    idempotencyKey: z.string().trim().min(1).max(255).optional(),
    correlationId: z.string().trim().min(1).max(255).optional(),
    tags: z.array(z.string().trim().min(1).max(128)).max(50).optional(),
  })
  .strict()

export type WorkflowAdminSurface = "tenant" | "cloud" | "disabled"

export function resolveWorkflowAdminSurface(value: string | undefined): WorkflowAdminSurface {
  if (value === "tenant" || value === "cloud" || value === "disabled") return value
  if (value !== undefined && value.trim().length > 0) {
    throw new Error(
      `Invalid workflow admin surface "${value}". Expected tenant, cloud, or disabled.`,
    )
  }
  return "tenant"
}

function hasWorkflowTriggerScope(scopes: unknown): boolean {
  if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === "string")) {
    return false
  }

  return scopes.some((scope) => {
    const normalized = scope.trim().toLowerCase()
    return (
      normalized === "*" ||
      normalized === "*:*" ||
      normalized === "*:trigger" ||
      normalized === "workflows:*" ||
      normalized === "workflows:trigger"
    )
  })
}

export interface MountWorkflowRunsAdminRoutesOptions {
  /**
   * Registry of executable runners keyed by workflow name. Required
   * for the rerun/resume endpoints; bundles register their runners
   * on bootstrap.
   */
  runners?: WorkflowRunnerRegistry
  /**
   * Resolves the acting user id from the request context — used to
   * stamp `triggered_by_user_id` on rerun runs. When omitted, runs
   * are recorded without an actor.
   */
  resolveUserId?: (c: unknown) => string | null
  /**
   * Controls whether tenant-admin workflow management actions are exposed.
   * `tenant` preserves local/self-host behavior. `cloud` and `disabled`
   * reject tenant-admin trigger/rerun/resume routes server-side while leaving
   * read paths mounted for observability consumers that still need them.
   */
  adminSurface?: WorkflowAdminSurface
}

// ──────────────────────────────────────────────────────────────────
// Response schemas (Drizzle `$inferSelect` → wire shapes)
// ──────────────────────────────────────────────────────────────────

const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown()).nullable()

/** Compact error payload stored as jsonb on a run/step. */
const workflowRunErrorSchema = z
  .object({
    message: z.string(),
    code: z.string().optional(),
    stepName: z.string().optional(),
    stack: z.string().optional(),
  })
  .nullable()

/** `workflow_runs` row. */
const workflowRunSchema = z.object({
  id: z.string(),
  workflowName: z.string(),
  trigger: z.string(),
  correlationId: z.string().nullable(),
  tags: z.array(z.string()),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]),
  input: jsonRecord,
  result: jsonRecord,
  error: workflowRunErrorSchema,
  parentRunId: z.string().nullable(),
  triggeredByUserId: z.string().nullable(),
  resumeFromStep: z.string().nullable(),
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  durationMs: z.number().int().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `workflow_run_steps` row. */
const workflowRunStepSchema = z.object({
  id: z.string(),
  runId: z.string(),
  stepName: z.string(),
  sequence: z.number().int(),
  status: z.enum(["running", "succeeded", "failed", "skipped", "compensated"]),
  output: jsonRecord,
  error: workflowRunErrorSchema,
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  durationMs: z.number().int().nullable(),
})

/** Permissive error envelope — every typed-error leg returns `{ error, ... }`. */
const errorResponseSchema = z.object({ error: z.string() }).catchall(z.unknown())

const listRunsResponseSchema = listResponseSchema(workflowRunSchema)
const runDetailResponseSchema = z.object({
  data: z.object({ run: workflowRunSchema, steps: z.array(workflowRunStepSchema) }),
})
const triggerResponseSchema = z.object({
  data: z.object({ runId: z.string(), workflowName: z.string(), status: z.string() }),
})
const rerunResponseSchema = z.object({
  data: z.object({ runId: z.string(), parentRunId: z.string() }),
})
const resumeResponseSchema = z.object({
  data: z.object({
    runId: z.string(),
    parentRunId: z.string(),
    resumeFromStep: z.string(),
  }),
})

const idParamSchema = z.object({ id: z.string() })
const nameParamSchema = z.object({ name: z.string() })

const json = <T extends z.ZodTypeAny>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
})
const err = (description: string) => json(errorResponseSchema, description)

// ──────────────────────────────────────────────────────────────────
// Route definitions
// ──────────────────────────────────────────────────────────────────

export const WORKFLOW_RUNS_OPENAPI_API_ID = "@voyant-travel/workflow-runs#api.admin"

const listRunsRoute = createRoute({
  method: "get",
  path: "/v1/admin/workflow-runs",
  "x-voyant-api-id": WORKFLOW_RUNS_OPENAPI_API_ID,
  responses: {
    200: json(listRunsResponseSchema, "Recorded workflow runs (filtered + paginated)"),
    400: err("invalid_query: filter/pagination query failed validation"),
    500: err("db_unavailable / list_failed"),
  },
})

const getRunRoute = createRoute({
  method: "get",
  path: "/v1/admin/workflow-runs/{id}",
  "x-voyant-api-id": WORKFLOW_RUNS_OPENAPI_API_ID,
  request: { params: idParamSchema },
  responses: {
    200: json(runDetailResponseSchema, "The run with its ordered steps"),
    404: err("not_found"),
    500: err("db_unavailable / get_failed"),
  },
})

const triggerWorkflowRoute = createRoute({
  method: "post",
  path: "/v1/admin/workflows/{name}/runs",
  "x-voyant-api-id": WORKFLOW_RUNS_OPENAPI_API_ID,
  request: { params: nameParamSchema },
  responses: {
    202: json(triggerResponseSchema, "Run queued"),
    400: err("invalid_request: trigger body failed validation"),
    403: err("workflow_admin_surface_restricted / missing trigger scope"),
    404: err("runner_not_registered"),
    500: err("trigger_failed"),
    501: err("trigger_not_configured / trigger_not_supported"),
  },
})

const rerunRunRoute = createRoute({
  method: "post",
  path: "/v1/admin/workflow-runs/{id}/rerun",
  "x-voyant-api-id": WORKFLOW_RUNS_OPENAPI_API_ID,
  request: { params: idParamSchema },
  responses: {
    202: json(rerunResponseSchema, "Rerun queued"),
    400: err("invalid_body"),
    403: err("workflow_admin_surface_restricted"),
    404: err("not_found"),
    409: err("rerun_not_allowed / confirmation_required / rerun_blocked"),
    500: err("rerun_failed"),
    501: err("rerun_not_configured / runner_not_registered"),
  },
})

const resumeRunRoute = createRoute({
  method: "post",
  path: "/v1/admin/workflow-runs/{id}/resume",
  "x-voyant-api-id": WORKFLOW_RUNS_OPENAPI_API_ID,
  request: { params: idParamSchema },
  responses: {
    202: json(resumeResponseSchema, "Resume queued"),
    403: err("workflow_admin_surface_restricted"),
    404: err("not_found"),
    409: err("resume_not_allowed / no_failed_step / incomplete_prior_step"),
    500: err("resume_failed"),
    501: err("resume_not_configured / runner_not_registered"),
  },
})

export function mountWorkflowRunsAdminRoutes(
  hono: WorkflowRunsMountTarget,
  opts: MountWorkflowRunsAdminRoutesOptions = {},
): void {
  const adminSurface = opts.adminSurface ?? defaultWorkflowAdminSurface()

  const handleListRuns = async (c: Context): Promise<Response> => {
    const params = Object.fromEntries(new URL(c.req.url).searchParams)
    const parsed = listQuerySchema.safeParse(params)
    if (!parsed.success) {
      return c.json({ error: "invalid_query", detail: parsed.error.issues }, 400)
    }
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed -- owner: workflow-runs; existing suppression is intentional pending typed cleanup.
    const db = (c.var as any).db
    if (!db) {
      console.error("[workflow-runs] c.var.db is undefined — middleware ordering issue?")
      return c.json({ error: "db_unavailable" }, 500)
    }
    try {
      const result = await workflowRunsService.listRuns(db, parsed.data)
      return c.json(result)
    } catch (err) {
      console.error("[workflow-runs] listRuns failed", err)
      return c.json(
        {
          error: "list_failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        500,
      )
    }
  }

  const handleGetRun = async (c: Context): Promise<Response> => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed -- owner: workflow-runs; existing suppression is intentional pending typed cleanup.
    const db = (c.var as any).db
    if (!db) return c.json({ error: "db_unavailable" }, 500)
    try {
      const result = await workflowRunsService.getRunById(db, c.req.param("id") ?? "")
      if (!result) return c.json({ error: "not_found" }, 404)
      return c.json({ data: result })
    } catch (err) {
      console.error("[workflow-runs] getRunById failed", err)
      return c.json(
        {
          error: "get_failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        500,
      )
    }
  }

  const handleTrigger = async (c: Context): Promise<Response> => {
    const blocked = rejectWorkflowAdminAction(adminSurface, c)
    if (blocked) return blocked

    if (!opts.runners) {
      return c.json(
        { error: "trigger_not_configured", detail: "no WorkflowRunnerRegistry mounted" },
        501,
      )
    }

    let body: z.infer<typeof triggerWorkflowBodySchema>
    try {
      body = await parseJsonBody(c, triggerWorkflowBodySchema)
    } catch (err) {
      return handleApiError(err, c)
    }

    const workflowName = c.req.param("name") ?? ""
    const runner = opts.runners.get(workflowName)
    if (!runner) {
      return c.json(
        {
          error: "runner_not_registered",
          detail: `No runner registered for workflow "${workflowName}"`,
        },
        404,
      )
    }
    if (!runner.trigger) {
      return c.json(
        {
          error: "trigger_not_supported",
          detail: `Workflow "${runner.name}" does not expose admin trigger support.`,
        },
        501,
      )
    }

    const auth = c as { get(name: string): unknown }
    if (auth.get("callerType") === "api_key" && !hasWorkflowTriggerScope(auth.get("scopes"))) {
      return c.json({ error: "Forbidden: API key missing workflows:trigger permission" }, 403)
    }

    const userId = opts.resolveUserId?.(c) ?? null
    try {
      const input = Object.hasOwn(body, "input") ? body.input : {}
      const { runId } = await runner.trigger(input, {
        triggeredByUserId: userId,
        correlationId: body.correlationId ?? null,
        tags: body.tags ?? [],
        idempotencyKey: body.idempotencyKey ?? null,
      })
      return c.json({ data: { runId, workflowName: runner.name, status: "queued" } }, 202)
    } catch (err) {
      console.error("[workflow-runs] trigger failed", err)
      return c.json(
        { error: "trigger_failed", detail: err instanceof Error ? err.message : String(err) },
        500,
      )
    }
  }

  const handleRerun = async (c: Context): Promise<Response> => {
    const blocked = rejectWorkflowAdminAction(adminSurface, c)
    if (blocked) return blocked

    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed -- owner: workflow-runs; existing suppression is intentional pending typed cleanup.
    const db = (c.var as any).db
    if (!db) return c.json({ error: "db_unavailable" }, 500)
    if (!opts.runners) {
      return c.json(
        { error: "rerun_not_configured", detail: "no WorkflowRunnerRegistry mounted" },
        501,
      )
    }
    const parentId = c.req.param("id") ?? ""
    const detail = await workflowRunsService.getRunById(db, parentId)
    if (!detail) return c.json({ error: "not_found" }, 404)

    const runner = opts.runners.get(detail.run.workflowName)
    if (!runner) {
      return c.json(
        {
          error: "runner_not_registered",
          detail: `No runner registered for workflow "${detail.run.workflowName}"`,
        },
        501,
      )
    }
    if (runner.idempotency === "resume-only") {
      return c.json(
        {
          error: "rerun_not_allowed",
          detail: `Workflow "${runner.name}" is resume-only; use POST /:id/resume instead.`,
        },
        409,
      )
    }

    let body: { confirm?: boolean } = {}
    try {
      body = rerunBodySchema.parse(await c.req.json().catch(() => ({})))
    } catch (err) {
      return c.json(
        { error: "invalid_body", detail: err instanceof Error ? err.message : String(err) },
        400,
      )
    }

    if (runner.idempotency === "unsafe" && !body.confirm) {
      return c.json(
        {
          error: "confirmation_required",
          detail: `Workflow "${runner.name}" has side effects; pass { confirm: true } to rerun.`,
          idempotency: runner.idempotency,
        },
        409,
      )
    }

    if (runner.canRerun) {
      const guard = await runner.canRerun(detail.run.input)
      if (!guard.ok) {
        return c.json({ error: "rerun_blocked", detail: guard.reason }, 409)
      }
    }

    const userId = opts.resolveUserId?.(c) ?? null
    try {
      const { runId } = await runner.rerun(detail.run.input, {
        parentRunId: detail.run.id,
        triggeredByUserId: userId,
        correlationId: detail.run.correlationId,
        tags: detail.run.tags,
      })
      return c.json({ data: { runId, parentRunId: detail.run.id } }, 202)
    } catch (err) {
      console.error("[workflow-runs] rerun failed", err)
      return c.json(
        { error: "rerun_failed", detail: err instanceof Error ? err.message : String(err) },
        500,
      )
    }
  }

  const handleResume = async (c: Context): Promise<Response> => {
    const blocked = rejectWorkflowAdminAction(adminSurface, c)
    if (blocked) return blocked

    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed -- owner: workflow-runs; existing suppression is intentional pending typed cleanup.
    const db = (c.var as any).db
    if (!db) return c.json({ error: "db_unavailable" }, 500)
    if (!opts.runners) {
      return c.json(
        { error: "resume_not_configured", detail: "no WorkflowRunnerRegistry mounted" },
        501,
      )
    }

    const parentId = c.req.param("id") ?? ""
    const detail = await workflowRunsService.getRunById(db, parentId)
    if (!detail) return c.json({ error: "not_found" }, 404)
    if (detail.run.status !== "failed") {
      return c.json(
        {
          error: "resume_not_allowed",
          detail: `Cannot resume a run with status "${detail.run.status}"; only failed runs are resumable.`,
        },
        409,
      )
    }

    const runner = opts.runners.get(detail.run.workflowName)
    if (!runner) {
      return c.json(
        {
          error: "runner_not_registered",
          detail: `No runner registered for workflow "${detail.run.workflowName}"`,
        },
        501,
      )
    }

    // Find the failed step and seed prior step outputs.
    const failedStep = detail.steps.find((s) => s.status === "failed")
    if (!failedStep) {
      return c.json(
        {
          error: "no_failed_step",
          detail: "Run is marked failed but has no failed step row to resume from.",
        },
        409,
      )
    }
    const seedResults: Record<string, unknown> = {}
    for (const s of detail.steps) {
      if (s.sequence >= failedStep.sequence) break
      if (s.status === "succeeded" || s.status === "skipped") {
        if (s.output && typeof s.output === "object") {
          seedResults[s.stepName] = s.output
        } else {
          // Preserve null/primitive outputs explicitly so downstream
          // steps that read them don't see undefined.
          seedResults[s.stepName] = s.output ?? null
        }
      } else {
        return c.json(
          {
            error: "incomplete_prior_step",
            detail: `Step "${s.stepName}" (sequence ${s.sequence}) is not complete; cannot resume past it.`,
          },
          409,
        )
      }
    }

    const userId = opts.resolveUserId?.(c) ?? null
    try {
      const { runId } = await runner.resume(detail.run.input, {
        parentRunId: detail.run.id,
        triggeredByUserId: userId,
        correlationId: detail.run.correlationId,
        tags: detail.run.tags,
        resumeFromStep: failedStep.stepName,
        seedResults,
      })
      return c.json(
        { data: { runId, parentRunId: detail.run.id, resumeFromStep: failedStep.stepName } },
        202,
      )
    } catch (err) {
      console.error("[workflow-runs] resume failed", err)
      return c.json(
        { error: "resume_failed", detail: err instanceof Error ? err.message : String(err) },
        500,
      )
    }
  }

  const routes = new OpenAPIHono({ defaultHook: openApiValidationHook })
    .openapi(listRunsRoute, (c) => asRouteResponse(handleListRuns(c)))
    .openapi(getRunRoute, (c) => asRouteResponse(handleGetRun(c)))
    .openapi(triggerWorkflowRoute, (c) => asRouteResponse(handleTrigger(c)))
    .openapi(rerunRunRoute, (c) => asRouteResponse(handleRerun(c)))
    .openapi(resumeRunRoute, (c) => asRouteResponse(handleResume(c)))

  hono.route("/", routes)
}

function rejectWorkflowAdminAction(
  surface: WorkflowAdminSurface,
  c: { json(body: unknown, status?: number): Response },
): Response | undefined {
  if (surface === "tenant") return undefined
  return c.json(
    {
      error: "workflow_admin_surface_restricted",
      detail:
        surface === "cloud"
          ? "Workflow management actions are owned by Voyant Cloud for this deployment."
          : "Workflow management actions are disabled for this deployment.",
      surface,
    },
    403,
  )
}

function defaultWorkflowAdminSurface(): WorkflowAdminSurface {
  const env = (
    globalThis as typeof globalThis & {
      process?: {
        env?: {
          VOYANT_CLOUD_APP_SLUG?: string
          VOYANT_CLOUD_WORKFLOWS_URL?: string
          VOYANT_WORKFLOW_ADMIN_SURFACE?: string
        }
      }
    }
  ).process?.env
  if (env?.VOYANT_WORKFLOW_ADMIN_SURFACE !== undefined) {
    return resolveWorkflowAdminSurface(env.VOYANT_WORKFLOW_ADMIN_SURFACE)
  }
  if (env?.VOYANT_CLOUD_WORKFLOWS_URL || env?.VOYANT_CLOUD_APP_SLUG) return "cloud"
  return "tenant"
}
