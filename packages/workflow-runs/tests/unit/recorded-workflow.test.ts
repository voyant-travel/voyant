import { __resetRegistry } from "@voyantjs/workflows"
import type { ServiceResolver } from "@voyantjs/workflows/driver"
import { createInMemoryDriver } from "@voyantjs/workflows-orchestrator"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { workflowRuns } from "../../src/schema.js"
import { workflowRunsService } from "../../src/service.js"
import { recordedWorkflow } from "../../src/workflows.js"

let unique = 0

function uniqueId(prefix: string): string {
  unique += 1
  return `${prefix}-${unique}`
}

function makeResolver(entries: Record<string, unknown> = {}): ServiceResolver {
  return {
    resolve<T>(name: string): T {
      if (!(name in entries)) throw new Error(`test service "${name}" is not registered`)
      return entries[name] as T
    },
    has(name: string): boolean {
      return name in entries
    },
  }
}

function makeDriver(services = makeResolver()) {
  return createInMemoryDriver({ disableScheduleRunner: true })({
    services,
    logger: () => {
      // no-op
    },
  })
}

describe("recordedWorkflow", () => {
  beforeEach(() => {
    __resetRegistry()
  })

  afterEach(() => {
    __resetRegistry()
  })

  test("does not fail the workflow when recording dependencies are unavailable", async () => {
    const wf = recordedWorkflow<string, string>({
      id: uniqueId("recording-unavailable"),
      async run(input) {
        return `handled:${input}`
      },
    })
    const driver = makeDriver()

    const run = await driver.trigger(wf, "input")

    expect(run.status).toBe("completed")
  })
})

describe("recordedWorkflow persistence", () => {
  beforeEach(() => {
    __resetRegistry()
  })

  afterEach(() => {
    __resetRegistry()
  })

  test("records a successful workflow run visible through the workflow-runs service", async () => {
    const db = createMemoryWorkflowRunsDb()
    const workflowId = uniqueId("recorded-success")
    const wf = recordedWorkflow<{ bookingId: string }, { ok: true; runId: string }>(
      {
        id: workflowId,
        tags: ["configured"],
        async run(_input, ctx) {
          return { ok: true, runId: ctx.run.id }
        },
      },
      { tags: ["observability"] },
    )
    const driver = makeDriver(makeResolver({ db }))

    const run = await driver.trigger(wf, { bookingId: "bk_123" }, { tags: ["runtime"] })

    expect(run.status).toBe("completed")
    const runs = await workflowRunsService.listRuns(db, { workflowName: workflowId })
    expect(runs.total).toBe(1)
    const recorded = runs.data[0]
    expect(recorded).toMatchObject({
      workflowName: workflowId,
      trigger: "api",
      correlationId: run.id,
      status: "succeeded",
      input: { bookingId: "bk_123" },
      result: { ok: true, runId: run.id },
      error: null,
    })
    expect(recorded?.tags).toEqual(["configured", "runtime", "observability"])

    const detail = await workflowRunsService.getRunById(db, recorded!.id)
    expect(detail?.run.id).toBe(recorded?.id)
  })

  test("records a failed workflow run while preserving workflow failure status", async () => {
    const db = createMemoryWorkflowRunsDb()
    const workflowId = uniqueId("recorded-failure")
    const wf = recordedWorkflow<{ attempt: number }, never>({
      id: workflowId,
      async run() {
        const err = new Error("pdf rendering failed")
        ;(err as Error & { code?: string }).code = "PDF_RENDER_FAILED"
        throw err
      },
    })
    const driver = makeDriver(makeResolver({ db }))

    const run = await driver.trigger(wf, { attempt: 2 })

    expect(run.status).toBe("failed")
    const runs = await workflowRunsService.listRuns(db, {
      workflowName: workflowId,
      status: "failed",
    })
    expect(runs.total).toBe(1)
    const recorded = runs.data[0]
    expect(recorded).toMatchObject({
      workflowName: workflowId,
      trigger: "api",
      correlationId: run.id,
      status: "failed",
      input: { attempt: 2 },
      result: null,
    })
    expect(recorded?.error).toMatchObject({
      message: "pdf rendering failed",
    })
  })
})

function createMemoryWorkflowRunsDb(): PostgresJsDatabase {
  const runs: Array<Record<string, unknown>> = []
  const steps: Array<Record<string, unknown>> = []
  let runSeq = 0
  let stepSeq = 0

  function rowsFor(table: unknown): Array<Record<string, unknown>> {
    return table === workflowRuns ? runs : steps
  }

  function nextId(table: unknown): string {
    if (table === workflowRuns) {
      runSeq += 1
      return `wfrn_test_${runSeq}`
    }
    stepSeq += 1
    return `wfrs_test_${stepSeq}`
  }

  const db = {
    insert(table: unknown) {
      return {
        values(value: Record<string, unknown>) {
          const row = {
            id: value.id ?? nextId(table),
            ...value,
            startedAt: value.startedAt ?? new Date(),
            createdAt: value.createdAt ?? new Date(),
            updatedAt: value.updatedAt ?? new Date(),
          }
          rowsFor(table).push(row)
          return {
            returning() {
              return [{ id: row.id }]
            },
          }
        },
      }
    },
    update(table: unknown) {
      return {
        set(patch: Record<string, unknown>) {
          return {
            where() {
              for (const row of rowsFor(table)) Object.assign(row, patch)
              return Promise.resolve()
            },
          }
        },
      }
    },
    select(selection?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const query = makeQuery(rowsFor(table), selection)
          return query
        },
      }
    },
  }
  return db as PostgresJsDatabase
}

function makeQuery(rows: Array<Record<string, unknown>>, selection?: Record<string, unknown>) {
  let limitValue: number | undefined
  const query = {
    where() {
      if (selection && "count" in selection) return materializeRows(rows, selection, undefined, 0)
      return query
    },
    orderBy() {
      return query
    },
    limit(value: number) {
      limitValue = value
      return withOffset(materializeRows(rows, selection, limitValue, 0), (offsetValue) =>
        materializeRows(rows, selection, limitValue, offsetValue),
      )
    },
  }
  return query
}

function materializeRows(
  rows: Array<Record<string, unknown>>,
  selection: Record<string, unknown> | undefined,
  limitValue: number | undefined,
  offsetValue: number,
): Array<Record<string, unknown>> {
  if (selection && "count" in selection) return [{ count: rows.length }]
  const end = limitValue === undefined ? undefined : offsetValue + limitValue
  return rows.slice(offsetValue, end)
}

function withOffset<T>(
  rows: T[],
  resolveOffset: (offset: number) => T[],
): T[] & { offset(offset: number): T[] } {
  return Object.assign(rows, {
    offset: resolveOffset,
  })
}
