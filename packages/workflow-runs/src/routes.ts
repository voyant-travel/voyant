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
 */

import { handleApiError, parseJsonBody } from "@voyantjs/hono"
import type { Hono } from "hono"
import { z } from "zod"

import type { WorkflowRunnerRegistry } from "./runner.js"
import { workflowRunsService } from "./service.js"

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
}

export function mountWorkflowRunsAdminRoutes(
  hono: Hono,
  opts: MountWorkflowRunsAdminRoutesOptions = {},
): void {
  hono.get("/v1/admin/workflow-runs", async (c) => {
    const params = Object.fromEntries(new URL(c.req.url).searchParams)
    const parsed = listQuerySchema.safeParse(params)
    if (!parsed.success) {
      return c.json({ error: "invalid_query", detail: parsed.error.issues }, 400)
    }
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
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
  })

  hono.get("/v1/admin/workflow-runs/:id", async (c) => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
    const db = (c.var as any).db
    if (!db) return c.json({ error: "db_unavailable" }, 500)
    try {
      const result = await workflowRunsService.getRunById(db, c.req.param("id"))
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
  })

  hono.post("/v1/admin/workflows/:name/runs", async (c) => {
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

    const workflowName = c.req.param("name")
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
  })

  hono.post("/v1/admin/workflow-runs/:id/rerun", async (c) => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
    const db = (c.var as any).db
    if (!db) return c.json({ error: "db_unavailable" }, 500)
    if (!opts.runners) {
      return c.json(
        { error: "rerun_not_configured", detail: "no WorkflowRunnerRegistry mounted" },
        501,
      )
    }
    const parentId = c.req.param("id")
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
  })

  hono.post("/v1/admin/workflow-runs/:id/resume", async (c) => {
    // biome-ignore lint/suspicious/noExplicitAny: Hono's c.var.db is loosely typed
    const db = (c.var as any).db
    if (!db) return c.json({ error: "db_unavailable" }, 500)
    if (!opts.runners) {
      return c.json(
        { error: "resume_not_configured", detail: "no WorkflowRunnerRegistry mounted" },
        501,
      )
    }

    const parentId = c.req.param("id")
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
  })
}
