import { requireActor } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { afterEach, describe, expect, test, vi } from "vitest"

import { beginWorkflowRun } from "../../src/recorder.js"
import {
  mountWorkflowRunsAdminRoutes,
  resolveWorkflowAdminSurface,
  type WorkflowAdminSurface,
} from "../../src/routes.js"
import { type WorkflowRunner, WorkflowRunnerRegistry } from "../../src/runner.js"
import { workflowRuns } from "../../src/schema.js"
import { workflowRunsService } from "../../src/service.js"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("workflow-runs admin routes", () => {
  test("triggers a registered workflow by name and records an observable run", async () => {
    const db = createMemoryWorkflowRunsDb()
    const registry = new WorkflowRunnerRegistry()
    registry.register(
      makeRunner({
        name: "checkout-finalize",
        async trigger(input, ctx) {
          const recorder = await beginWorkflowRun(db, {
            workflowName: "checkout-finalize",
            trigger: "admin",
            correlationId: ctx.correlationId,
            tags: ctx.tags,
            input: input as Record<string, unknown>,
            triggeredByUserId: ctx.triggeredByUserId,
          })
          await recorder.complete({ queued: true })
          return { runId: recorder.runId }
        },
      }),
    )
    const app = makeAuthorizedApp({ registry, db, actor: "staff", userId: "user_123" })

    const res = await app.request("/v1/admin/workflows/checkout-finalize/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { bookingId: "bk_123" },
        correlationId: "corr_123",
        tags: ["source:admin"],
      }),
    })

    expect(res.status).toBe(202)
    const body = (await res.json()) as {
      data: { runId: string; workflowName: string; status: string }
    }
    expect(body.data).toMatchObject({
      workflowName: "checkout-finalize",
      status: "queued",
    })

    const runs = await workflowRunsService.listRuns(db, { workflowName: "checkout-finalize" })
    expect(runs.total).toBe(1)
    expect(runs.data[0]).toMatchObject({
      id: body.data.runId,
      workflowName: "checkout-finalize",
      trigger: "admin",
      correlationId: "corr_123",
      tags: ["source:admin"],
      input: { bookingId: "bk_123" },
      status: "succeeded",
      triggeredByUserId: "user_123",
      result: { queued: true },
    })
  })

  test("allows API keys with workflows:trigger permission", async () => {
    for (const scopes of [["workflows:trigger"], ["workflows:*"], ["*:trigger"], ["*"]]) {
      const registry = new WorkflowRunnerRegistry()
      registry.register(makeRunner({ name: "sync-products" }))
      const app = makeAuthorizedApp({
        registry,
        callerType: "api_key",
        scopes,
      })

      const res = await app.request("/v1/admin/workflows/sync-products/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { full: true } }),
      })

      expect(res.status).toBe(202)
    }
  })

  test("rejects anonymous and insufficiently scoped callers before dispatch", async () => {
    const registry = new WorkflowRunnerRegistry()
    let calls = 0
    registry.register(
      makeRunner({
        name: "sync-products",
        async trigger() {
          calls += 1
          return { runId: "run_forbidden" }
        },
      }),
    )

    const anonymous = makeAuthorizedApp({ registry })
    const anonymousRes = await anonymous.request("/v1/admin/workflows/sync-products/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    })
    expect(anonymousRes.status).toBe(401)

    for (const scopes of [["workflows:read"], ["workflows:write"], ["workflows:relay"]]) {
      const apiKey = makeAuthorizedApp({
        registry,
        callerType: "api_key",
        scopes,
      })
      const scopedRes = await apiKey.request("/v1/admin/workflows/sync-products/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: {} }),
      })
      expect(scopedRes.status).toBe(403)
    }
    expect(calls).toBe(0)
  })

  test("returns validation and unknown workflow errors", async () => {
    const registry = new WorkflowRunnerRegistry()
    registry.register(makeRunner({ name: "known-workflow" }))
    const app = makeAuthorizedApp({ registry, actor: "staff" })

    const malformed = await app.request("/v1/admin/workflows/known-workflow/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })
    expect(malformed.status).toBe(400)
    expect((await malformed.json()) as { code: string }).toMatchObject({
      code: "invalid_request",
    })

    const unknown = await app.request("/v1/admin/workflows/missing-workflow/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    })
    expect(unknown.status).toBe(404)
    expect((await unknown.json()) as { error: string }).toMatchObject({
      error: "runner_not_registered",
    })
  })

  test("surfaces runner failures as trigger_failed", async () => {
    const registry = new WorkflowRunnerRegistry()
    registry.register(
      makeRunner({
        name: "send-invoices",
        async trigger() {
          throw new Error("invoice provider unavailable")
        },
      }),
    )
    const app = makeAuthorizedApp({ registry, actor: "staff" })

    const res = await app.request("/v1/admin/workflows/send-invoices/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { invoiceId: "inv_123" } }),
    })

    expect(res.status).toBe(500)
    expect((await res.json()) as { error: string; detail: string }).toMatchObject({
      error: "trigger_failed",
      detail: "invoice provider unavailable",
    })
  })

  test("rejects tenant-admin workflow actions in cloud and disabled surface modes", async () => {
    for (const adminSurface of ["cloud", "disabled"] satisfies WorkflowAdminSurface[]) {
      const registry = new WorkflowRunnerRegistry()
      let calls = 0
      registry.register(
        makeRunner({
          name: "sync-products",
          async trigger() {
            calls += 1
            return { runId: "run_blocked" }
          },
        }),
      )
      const app = makeAuthorizedApp({ registry, actor: "staff", adminSurface })

      const res = await app.request("/v1/admin/workflows/sync-products/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: {} }),
      })

      expect(res.status).toBe(403)
      expect((await res.json()) as { error: string; surface: WorkflowAdminSurface }).toMatchObject({
        error: "workflow_admin_surface_restricted",
        surface: adminSurface,
      })
      expect(calls).toBe(0)
    }
  })

  test("does not infer provider ownership from environment", async () => {
    vi.stubEnv("VOYANT_CLOUD_WORKFLOWS_URL", "https://api.voyant.test")
    vi.stubEnv("VOYANT_WORKFLOW_ADMIN_SURFACE", "cloud")
    const registry = new WorkflowRunnerRegistry()
    let calls = 0
    registry.register(
      makeRunner({
        name: "sync-products",
        async trigger() {
          calls += 1
          return { runId: "run_blocked" }
        },
      }),
    )
    const app = makeAuthorizedApp({ registry, actor: "staff" })

    const res = await app.request("/v1/admin/workflows/sync-products/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    })

    expect(res.status).toBe(202)
    expect((await res.json()) as { data: { runId: string } }).toMatchObject({
      data: { runId: "run_blocked" },
    })
    expect(calls).toBe(1)
  })

  test("keeps workflow run reads available when cloud surface gates actions", async () => {
    const db = createMemoryWorkflowRunsDb()
    const registry = new WorkflowRunnerRegistry()
    registry.register(
      makeRunner({
        name: "sync-products",
        async trigger(input) {
          const recorder = await beginWorkflowRun(db, {
            workflowName: "sync-products",
            trigger: "admin",
            input: input as Record<string, unknown>,
          })
          await recorder.complete({ ok: true })
          return { runId: recorder.runId }
        },
      }),
    )
    const tenantApp = makeAuthorizedApp({ registry, db, actor: "staff" })
    await tenantApp.request("/v1/admin/workflows/sync-products/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    })

    const cloudApp = makeAuthorizedApp({ registry, db, actor: "staff", adminSurface: "cloud" })
    const res = await cloudApp.request("/v1/admin/workflow-runs")

    expect(res.status).toBe(200)
    expect((await res.json()) as { total: number }).toMatchObject({ total: 1 })
  })

  test("resolves documented workflow admin surface values", () => {
    expect(resolveWorkflowAdminSurface("tenant")).toBe("tenant")
    expect(resolveWorkflowAdminSurface("cloud")).toBe("cloud")
    expect(resolveWorkflowAdminSurface("disabled")).toBe("disabled")
    expect(resolveWorkflowAdminSurface(undefined)).toBe("tenant")
    expect(() => resolveWorkflowAdminSurface("public")).toThrow(/Invalid workflow admin surface/)
  })
})

function makeRunner(input: Partial<WorkflowRunner> & { name: string }): WorkflowRunner {
  return {
    idempotency: "safe",
    async trigger() {
      return { runId: "run_queued" }
    },
    async rerun() {
      return { runId: "run_rerun" }
    },
    async resume() {
      return { runId: "run_resume" }
    },
    ...input,
  }
}

function makeAuthorizedApp(options: {
  registry: WorkflowRunnerRegistry
  db?: PostgresJsDatabase
  actor?: string
  userId?: string
  callerType?: "api_key"
  scopes?: string[]
  adminSurface?: WorkflowAdminSurface
}) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    if (options.db) c.set("db" as never, options.db)
    if (options.actor) c.set("actor" as never, options.actor)
    if (options.userId) c.set("userId" as never, options.userId)
    if (options.callerType) c.set("callerType" as never, options.callerType)
    if (options.scopes) c.set("scopes" as never, options.scopes)
    await next()
  })
  app.use("/v1/admin/*", requireActor("staff"))
  mountWorkflowRunsAdminRoutes(app, {
    runners: options.registry,
    adminSurface: options.adminSurface,
    resolveUserId(c) {
      return (c as { get(name: "userId"): string | undefined }).get("userId") ?? null
    },
  })
  return app
}

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
          return makeQuery(rowsFor(table), selection)
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
