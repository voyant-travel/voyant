/**
 * `@voyantjs/workflow-runs` — schema for the lightweight observability
 * surface that records in-process workflow lifecycles (saga steps the
 * `@voyantjs/core/workflows` primitive runs, plus any other "I'm a
 * workflow" code path that opts in via `recordWorkflowRun`).
 *
 * Distinct from the durable `@voyantjs/workflows` SDK's
 * `voyant_snapshot_runs` schema — that one needs an orchestrator
 * process to drive it, which doesn't fit the Cloudflare Workers
 * deployment shape. This schema is edge-compatible (postgres-js or
 * neon-http) so templates can register the routes inside their
 * existing API surface.
 *
 * Tags as JSONB array — lets callers query "all runs for booking X"
 * without hard-coding domain joins. The recorder's convention is to
 * tag with `bookingId:<id>`, `paymentSessionId:<id>`, etc.
 */

import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import { check, index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const workflowRunStatusEnum = pgEnum("workflow_run_status", [
  "running",
  "succeeded",
  "failed",
  "cancelled",
])

export const workflowRunStepStatusEnum = pgEnum("workflow_run_step_status", [
  "running",
  "succeeded",
  "failed",
  "skipped",
  "compensated",
])

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: typeId("workflow_runs"),
    workflowName: text("workflow_name").notNull(),
    /** Where the run came from — usually an event name or a trigger id. */
    trigger: text("trigger").notNull().default("manual"),
    correlationId: text("correlation_id"),
    /** Free-form domain tags. Convention is `<key>:<value>` strings. */
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: workflowRunStatusEnum("status").notNull().default("running"),
    input: jsonb("input").$type<Record<string, unknown> | null>(),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    /** Compact error payload — message + optional code + step name. */
    error: jsonb("error").$type<WorkflowRunErrorPayload | null>(),
    /**
     * Parent run id when this run was triggered as a rerun/resume of
     * another run. Self-references the same table; nullable because
     * the original run has no parent.
     */
    parentRunId: text("parent_run_id"),
    /** User who triggered the rerun/resume (null for system runs). */
    triggeredByUserId: text("triggered_by_user_id"),
    /**
     * When set, the run is a resume — the executor skips steps until
     * (and not including) this step name, hydrating ctx.results from
     * the parent run's recorded step outputs.
     */
    resumeFromStep: text("resume_from_step"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workflow_runs_workflow").on(table.workflowName, table.startedAt),
    index("idx_workflow_runs_status_started").on(table.status, table.startedAt),
    index("idx_workflow_runs_correlation").on(table.correlationId),
    index("idx_workflow_runs_parent").on(table.parentRunId),
    // GIN index on tags so `tags @> '["bookingId:bk_…"]'::jsonb` is fast.
    index("idx_workflow_runs_tags_gin").using("gin", sql`${table.tags}`),
    check(
      "ck_workflow_runs_completion",
      sql`(
        ${table.status} = 'running' AND ${table.completedAt} IS NULL
      ) OR (
        ${table.status} <> 'running' AND ${table.completedAt} IS NOT NULL
      )`,
    ),
  ],
)

export const workflowRunSteps = pgTable(
  "workflow_run_steps",
  {
    id: typeId("workflow_run_steps"),
    runId: typeIdRef("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    stepName: text("step_name").notNull(),
    /** Order within the workflow — incremented as the step is reached. */
    sequence: integer("sequence").notNull(),
    status: workflowRunStepStatusEnum("status").notNull().default("running"),
    output: jsonb("output").$type<Record<string, unknown> | null>(),
    error: jsonb("error").$type<WorkflowRunErrorPayload | null>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("idx_workflow_run_steps_run").on(table.runId, table.sequence),
    index("idx_workflow_run_steps_status").on(table.status),
  ],
)

export interface WorkflowRunErrorPayload {
  message: string
  code?: string
  stepName?: string
  stack?: string
}

export type WorkflowRun = typeof workflowRuns.$inferSelect
export type NewWorkflowRun = typeof workflowRuns.$inferInsert
export type WorkflowRunStep = typeof workflowRunSteps.$inferSelect
export type NewWorkflowRunStep = typeof workflowRunSteps.$inferInsert
