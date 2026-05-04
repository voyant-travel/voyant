/**
 * Recorder API — wraps an in-process workflow run with start / step
 * lifecycle / finish writes against the `workflow_runs` +
 * `workflow_run_steps` tables.
 *
 * Designed for the `@voyantjs/core/workflows` saga primitive:
 * callers do
 *
 *   const recorder = await beginWorkflowRun(db, { workflowName, ... })
 *   try {
 *     const result = await runFn(recorder)
 *     await recorder.complete(result)
 *   } catch (err) {
 *     await recorder.fail(err)
 *     throw err
 *   }
 *
 * — and inside `runFn` the caller (or, more naturally, an
 * instrumented version of `runCheckoutFinalize`) calls
 * `recorder.startStep(name)` / `recorder.completeStep(name, output)` /
 * `recorder.failStep(name, error)` per step.
 *
 * The recorder is fire-and-forget around the actual run — it logs
 * persistence failures rather than rethrowing, so observability
 * outages never break the underlying business operation.
 */

import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type NewWorkflowRun,
  type NewWorkflowRunStep,
  type WorkflowRunErrorPayload,
  workflowRunSteps,
  workflowRuns,
} from "./schema.js"

export interface BeginWorkflowRunInput {
  workflowName: string
  trigger?: string
  correlationId?: string | null
  tags?: ReadonlyArray<string>
  input?: Record<string, unknown> | null
  /** Set when this run is a rerun/resume of a prior run. */
  parentRunId?: string | null
  /** User who triggered this run via the dashboard. */
  triggeredByUserId?: string | null
  /**
   * For resume runs — the step name from which to resume. The
   * executor seeds ctx.results with prior step outputs and skips
   * everything before this step.
   */
  resumeFromStep?: string | null
}

export interface WorkflowRunRecorder {
  readonly runId: string
  startStep(name: string): Promise<{ stepId: string | null }>
  completeStep(name: string, output?: Record<string, unknown> | null): Promise<void>
  failStep(name: string, error: unknown): Promise<void>
  /**
   * Record a step that was skipped by a resume run. Writes a row
   * with `status: "skipped"` and the supplied output (the value the
   * parent run produced). Used by the resume orchestrator so the UI
   * shows the full step list with the source of each output.
   */
  recordSkippedStep(name: string, output?: Record<string, unknown> | null): Promise<void>
  complete(result?: Record<string, unknown> | null): Promise<void>
  fail(error: unknown, opts?: { stepName?: string }): Promise<void>
  cancel(reason?: string): Promise<void>
}

/**
 * Start a run and return a recorder bound to its id. The row is
 * inserted with `status: "running"` and a `startedAt` of "now".
 *
 * Persistence errors are caught — if the table doesn't exist or the
 * DB is unreachable, returns a no-op recorder so the caller's
 * workflow keeps running. The whole point of this layer is
 * observability, not durability.
 */
export async function beginWorkflowRun(
  db: PostgresJsDatabase,
  input: BeginWorkflowRunInput,
): Promise<WorkflowRunRecorder> {
  const insert: NewWorkflowRun = {
    workflowName: input.workflowName,
    trigger: input.trigger ?? "manual",
    correlationId: input.correlationId ?? null,
    tags: [...(input.tags ?? [])],
    input: input.input ?? null,
    status: "running",
    parentRunId: input.parentRunId ?? null,
    triggeredByUserId: input.triggeredByUserId ?? null,
    resumeFromStep: input.resumeFromStep ?? null,
  }

  let runId: string | null = null
  try {
    const [row] = await db.insert(workflowRuns).values(insert).returning({ id: workflowRuns.id })
    runId = row?.id ?? null
  } catch (err) {
    console.warn(
      `[workflow-runs] could not record run start for "${input.workflowName}":`,
      err instanceof Error ? err.message : err,
    )
  }

  if (!runId) return noopRecorder()

  const stepStarts = new Map<string, { stepId: string; sequence: number; startedAt: number }>()
  let nextSequence = 1

  return {
    runId,
    async startStep(name) {
      const sequence = nextSequence++
      const insertStep: NewWorkflowRunStep = {
        runId,
        stepName: name,
        sequence,
        status: "running",
      }
      try {
        const [row] = await db
          .insert(workflowRunSteps)
          .values(insertStep)
          .returning({ id: workflowRunSteps.id })
        if (row?.id) {
          stepStarts.set(name, { stepId: row.id, sequence, startedAt: Date.now() })
          return { stepId: row.id }
        }
      } catch (err) {
        console.warn(`[workflow-runs] step start "${name}" insert failed:`, err)
      }
      return { stepId: null }
    },

    async completeStep(name, output) {
      const tracking = stepStarts.get(name)
      if (!tracking) return
      const completedAt = new Date()
      try {
        await db
          .update(workflowRunSteps)
          .set({
            status: "succeeded",
            output: output ?? null,
            completedAt,
            durationMs: completedAt.getTime() - tracking.startedAt,
          })
          .where(eq(workflowRunSteps.id, tracking.stepId))
      } catch (err) {
        console.warn(`[workflow-runs] step complete "${name}" update failed:`, err)
      }
    },

    async failStep(name, error) {
      const tracking = stepStarts.get(name)
      if (!tracking) return
      const completedAt = new Date()
      try {
        await db
          .update(workflowRunSteps)
          .set({
            status: "failed",
            error: serializeError(error, name),
            completedAt,
            durationMs: completedAt.getTime() - tracking.startedAt,
          })
          .where(eq(workflowRunSteps.id, tracking.stepId))
      } catch (err) {
        console.warn(`[workflow-runs] step fail "${name}" update failed:`, err)
      }
    },

    async recordSkippedStep(name, output) {
      const sequence = nextSequence++
      const now = new Date()
      const insertStep: NewWorkflowRunStep = {
        runId,
        stepName: name,
        sequence,
        status: "skipped",
        output: output ?? null,
        startedAt: now,
        completedAt: now,
        durationMs: 0,
      }
      try {
        await db.insert(workflowRunSteps).values(insertStep)
      } catch (err) {
        console.warn(`[workflow-runs] step skipped "${name}" insert failed:`, err)
      }
    },

    complete: (result) => finalize(db, runId, "succeeded", result, null),
    fail: (error, opts) =>
      finalize(db, runId, "failed", null, serializeError(error, opts?.stepName)),
    cancel: (reason) =>
      finalize(db, runId, "cancelled", null, {
        message: reason ?? "Cancelled",
      }),
  }
}

async function finalize(
  db: PostgresJsDatabase,
  runId: string,
  status: "succeeded" | "failed" | "cancelled",
  result: Record<string, unknown> | null | undefined,
  error: WorkflowRunErrorPayload | null,
): Promise<void> {
  const completedAt = new Date()
  try {
    const [existing] = await db
      .select({ startedAt: workflowRuns.startedAt })
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .limit(1)
    const durationMs = existing ? completedAt.getTime() - existing.startedAt.getTime() : null
    await db
      .update(workflowRuns)
      .set({
        status,
        result: result ?? null,
        error: error ?? null,
        completedAt,
        durationMs,
        updatedAt: completedAt,
      })
      .where(eq(workflowRuns.id, runId))
  } catch (err) {
    console.warn(`[workflow-runs] finalize ${status} failed for ${runId}:`, err)
  }
}

function serializeError(error: unknown, stepName?: string): WorkflowRunErrorPayload {
  if (error instanceof Error) {
    return {
      message: error.message,
      ...(stepName ? { stepName } : {}),
      ...(error.stack ? { stack: error.stack } : {}),
    }
  }
  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
    ...(stepName ? { stepName } : {}),
  }
}

function noopRecorder(): WorkflowRunRecorder {
  return {
    runId: "",
    async startStep() {
      return { stepId: null }
    },
    async completeStep() {
      // no-op
    },
    async failStep() {
      // no-op
    },
    async recordSkippedStep() {
      // no-op
    },
    async complete() {
      // no-op
    },
    async fail() {
      // no-op
    },
    async cancel() {
      // no-op
    },
  }
}
