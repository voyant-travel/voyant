/**
 * Read-side service for the workflow runs UI. The recorder writes
 * rows; this is what the dashboard SPA / admin endpoints query.
 */

import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { type WorkflowRun, type WorkflowRunStep, workflowRunSteps, workflowRuns } from "./schema.js"

export interface ListWorkflowRunsQuery {
  /** Filter by workflow id (e.g. "checkout-finalize"). */
  workflowName?: string
  /** Filter by status. */
  status?: "running" | "succeeded" | "failed" | "cancelled"
  /** Filter by tag membership — exact tag string match. */
  tag?: string
  limit?: number
  offset?: number
}

export interface ListWorkflowRunsResult {
  data: WorkflowRun[]
  total: number
  limit: number
  offset: number
}

export const workflowRunsService = {
  async listRuns(
    db: PostgresJsDatabase,
    query: ListWorkflowRunsQuery,
  ): Promise<ListWorkflowRunsResult> {
    const limit = clamp(query.limit ?? 50, 1, 200)
    const offset = Math.max(query.offset ?? 0, 0)
    const conds = []
    if (query.workflowName) conds.push(eq(workflowRuns.workflowName, query.workflowName))
    if (query.status) conds.push(eq(workflowRuns.status, query.status))
    if (query.tag) {
      // jsonb contains — `tags @> '["bookingId:bk_…"]'::jsonb`
      conds.push(sql`${workflowRuns.tags} @> ${JSON.stringify([query.tag])}::jsonb`)
    }
    const where = conds.length > 0 ? and(...conds) : undefined

    const [rows, countRow] = await Promise.all([
      db
        .select()
        .from(workflowRuns)
        .where(where)
        .orderBy(desc(workflowRuns.startedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(workflowRuns).where(where),
    ])

    return {
      data: rows,
      total: countRow[0]?.count ?? 0,
      limit,
      offset,
    }
  },

  async getRunById(
    db: PostgresJsDatabase,
    id: string,
  ): Promise<{ run: WorkflowRun; steps: WorkflowRunStep[] } | null> {
    const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).limit(1)
    if (!run) return null
    const steps = await db
      .select()
      .from(workflowRunSteps)
      .where(eq(workflowRunSteps.runId, id))
      .orderBy(workflowRunSteps.sequence)
    return { run, steps }
  },
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)))
}
