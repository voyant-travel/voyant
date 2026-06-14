import { workflow } from "@voyant-travel/workflows"
import type { RunRecord } from "@voyant-travel/workflows-orchestrator"
import { describe, expect, it } from "vitest"
import { createInMemoryKv, createKvScheduleStateStore, handleWorkerRequest } from "../index.js"
import { inProcessRunDONamespace, tenantMeta } from "./adapter-test-support.js"

describe("handleWorkerRequest (Worker → DO → tenant)", () => {
  it("triggers a run that completes in one invocation", async () => {
    workflow<{ n: number }, { doubled: number }>({
      id: "double",
      async run(input) {
        return { doubled: input.n * 2 }
      },
    })
    const runDO = inProcessRunDONamespace()
    const req = new Request("https://orch/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflowId: "double",
        workflowVersion: "v1",
        input: { n: 21 },
        tenantMeta,
      }),
    })
    const res = await handleWorkerRequest(req, { runDO })
    expect(res.status).toBe(200)
    const body = (await res.json()) as RunRecord
    expect(body.status).toBe("completed")
    expect(body.output).toEqual({ doubled: 42 })
  })

  it("records schedule dispatch state for scheduled triggers", async () => {
    workflow<{ n: number }, { doubled: number }>({
      id: "scheduled-double",
      async run(input) {
        return { doubled: input.n * 2 }
      },
    })
    const runDO = inProcessRunDONamespace()
    const scheduleStateStore = createKvScheduleStateStore({ kv: createInMemoryKv() })
    const now = Date.UTC(2026, 4, 30, 11, 0, 0)

    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "scheduled-double",
          workflowVersion: "v1",
          input: { n: 21 },
          tenantMeta,
          environment: "production",
          runId: "run_scheduled",
          triggeredBy: { kind: "schedule", scheduleId: "v_1:scheduled-double:hourly" },
        }),
      }),
      { runDO, scheduleStateStore, now: () => now },
    )

    expect(res.status).toBe(200)
    const states = await scheduleStateStore.getStates("production", ["v_1:scheduled-double:hourly"])
    expect(states.get("v_1:scheduled-double:hourly")).toMatchObject({
      scheduleId: "v_1:scheduled-double:hourly",
      environment: "production",
      lastFireAt: now,
      lastRunId: "run_scheduled",
      lastError: null,
      updatedAt: now,
    })
  })

  it("defaults scheduled trigger state to development when environment is omitted", async () => {
    workflow<{ n: number }, { doubled: number }>({
      id: "scheduled-default-env",
      async run(input) {
        return { doubled: input.n * 2 }
      },
    })
    const runDO = inProcessRunDONamespace()
    const scheduleStateStore = createKvScheduleStateStore({ kv: createInMemoryKv() })
    const now = Date.UTC(2026, 4, 30, 12, 0, 0)

    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "scheduled-default-env",
          workflowVersion: "v1",
          input: { n: 21 },
          tenantMeta,
          runId: "run_scheduled_default_env",
          triggeredBy: { kind: "schedule", scheduleId: "v_1:scheduled-default-env:hourly" },
        }),
      }),
      { runDO, scheduleStateStore, now: () => now },
    )

    expect(res.status).toBe(200)
    const states = await scheduleStateStore.getStates("development", [
      "v_1:scheduled-default-env:hourly",
    ])
    expect(states.get("v_1:scheduled-default-env:hourly")).toMatchObject({
      scheduleId: "v_1:scheduled-default-env:hourly",
      environment: "development",
      lastFireAt: now,
      lastRunId: "run_scheduled_default_env",
      lastError: null,
      updatedAt: now,
    })
  })

  it("records failed scheduled run outcomes in schedule dispatch state", async () => {
    workflow({
      id: "scheduled-fail",
      async run() {
        throw new Error("scheduled boom")
      },
    })
    const runDO = inProcessRunDONamespace()
    const scheduleStateStore = createKvScheduleStateStore({ kv: createInMemoryKv() })
    const now = Date.UTC(2026, 4, 30, 13, 0, 0)

    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "scheduled-fail",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          environment: "production",
          runId: "run_scheduled_fail",
          triggeredBy: { kind: "schedule", scheduleId: "v_1:scheduled-fail:hourly" },
        }),
      }),
      { runDO, scheduleStateStore, now: () => now },
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as RunRecord
    expect(body.status).toBe("failed")
    const states = await scheduleStateStore.getStates("production", ["v_1:scheduled-fail:hourly"])
    expect(states.get("v_1:scheduled-fail:hourly")).toMatchObject({
      scheduleId: "v_1:scheduled-fail:hourly",
      environment: "production",
      lastFireAt: now,
      lastRunId: "run_scheduled_fail",
      lastError: "scheduled boom",
      updatedAt: now,
    })
  })

  it("parks a run on a waitpoint and serves GET /api/runs/:id", async () => {
    workflow({
      id: "wait",
      async run(_i, ctx) {
        return await ctx.waitForEvent("greet")
      },
    })
    const runDO = inProcessRunDONamespace()
    const triggerRes = await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "wait",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_fixed",
        }),
      }),
      { runDO },
    )
    const parked = (await triggerRes.json()) as RunRecord
    expect(parked.status).toBe("waiting")

    const getRes = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_fixed", { method: "GET" }),
      { runDO },
    )
    const got = (await getRes.json()) as RunRecord
    expect(got.id).toBe("run_fixed")
    expect(got.status).toBe("waiting")
  })

  it("resumes a parked run via POST /api/runs/:id/events", async () => {
    workflow<void, { greeting: string }>({
      id: "greet",
      async run(_i, ctx) {
        const evt = await ctx.waitForEvent<{ name: string }>("greet")
        return { greeting: `hello ${evt!.name}` }
      },
    })
    const runDO = inProcessRunDONamespace()
    await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "greet",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_resume",
        }),
      }),
      { runDO },
    )
    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_resume/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "greet", payload: { name: "ada" } }),
      }),
      { runDO },
    )
    expect(res.status).toBe(200)
    const resumed = (await res.json()) as RunRecord
    expect(resumed.status).toBe("completed")
    expect(resumed.output).toEqual({ greeting: "hello ada" })
  })

  it("POST /api/runs/:id/signals injects a SIGNAL waitpoint", async () => {
    workflow<void, { ok: boolean }>({
      id: "approve",
      async run(_i, ctx) {
        const s = await ctx.waitForSignal<{ approved: boolean }>("approve")
        return { ok: s?.approved ?? false }
      },
    })
    const runDO = inProcessRunDONamespace()
    await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "approve",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_sig",
        }),
      }),
      { runDO },
    )
    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_sig/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "approve", payload: { approved: true } }),
      }),
      { runDO },
    )
    const body = (await res.json()) as RunRecord
    expect(body.status).toBe("completed")
    expect(body.output).toEqual({ ok: true })
  })

  it("POST /api/runs/:id/tokens/:tokenId injects a MANUAL waitpoint", async () => {
    workflow<void, string>({
      id: "tok",
      async run(_i, ctx) {
        const t = await ctx.waitForToken<string>({ tokenId: "approval-1" })
        const p = await t.wait()
        return p ?? "n"
      },
    })
    const runDO = inProcessRunDONamespace()
    await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "tok",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_tok",
        }),
      }),
      { runDO },
    )
    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_tok/tokens/approval-1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: "yes" }),
      }),
      { runDO },
    )
    const body = (await res.json()) as RunRecord
    expect(body.status).toBe("completed")
    expect(body.output).toBe("yes")
  })

  it("POST /api/runs/:id/cancel cancels a parked run", async () => {
    workflow({
      id: "park",
      async run(_i, ctx) {
        return await ctx.waitForEvent("never")
      },
    })
    const runDO = inProcessRunDONamespace()
    await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "park",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_cancel",
        }),
      }),
      { runDO },
    )
    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_cancel/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "no longer needed" }),
      }),
      { runDO },
    )
    const body = (await res.json()) as RunRecord
    expect(body.status).toBe("cancelled")
    expect(body.error?.message).toBe("no longer needed")
  })

  it("returns 401 when verifyRequest throws", async () => {
    const runDO = inProcessRunDONamespace()
    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs", { method: "POST", body: "{}" }),
      {
        runDO,
        verifyRequest: () => {
          throw new Error("no token")
        },
      },
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("unauthorized")
    expect(body.message).toBe("no token")
  })

  it("answers OPTIONS with CORS headers", async () => {
    const runDO = inProcessRunDONamespace()
    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs", { method: "OPTIONS" }),
      { runDO },
    )
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe("*")
  })

  it("returns 404 for unknown routes", async () => {
    const runDO = inProcessRunDONamespace()
    const res = await handleWorkerRequest(new Request("https://orch/unknown", { method: "GET" }), {
      runDO,
    })
    expect(res.status).toBe(404)
  })

  it("returns 400 on invalid waitpoint body", async () => {
    workflow({
      id: "p",
      async run(_i, ctx) {
        return await ctx.waitForEvent("x")
      },
    })
    const runDO = inProcessRunDONamespace()
    await handleWorkerRequest(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "p",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_bad",
        }),
      }),
      { runDO },
    )
    const res = await handleWorkerRequest(
      new Request("https://orch/api/runs/run_bad/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { runDO },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("invalid_body")
  })
})
