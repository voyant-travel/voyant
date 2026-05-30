import { __resetRegistry, workflow } from "@voyantjs/workflows"
import { handleStepRequest } from "@voyantjs/workflows/handler"
import type { RunRecord } from "@voyantjs/workflows-orchestrator"
import { beforeEach, describe, expect, it } from "vitest"
import {
  createDurableObjectRunStore,
  createInlineDispatcher,
  createInMemoryKv,
  createKvScheduleStateStore,
  createServiceBindingDispatcher,
  type DurableObjectNamespaceLike,
  type DurableObjectStorageLike,
  handleDurableObjectRequest,
  handleWorkerRequest,
  type ServiceBindingLike,
} from "../index.js"

// ---- Fakes ----

interface AlarmTrackingStorage extends DurableObjectStorageLike {
  _alarm: number | null
  _alarmCalls: number
  _deleteAlarmCalls: number
}

function makeStorage(): AlarmTrackingStorage {
  const map = new Map<string, unknown>()
  const s: AlarmTrackingStorage = {
    _alarm: null,
    _alarmCalls: 0,
    _deleteAlarmCalls: 0,
    async get<T>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined
    },
    async put<T>(key: string, value: T): Promise<void> {
      map.set(key, value)
    },
    async delete(key) {
      return map.delete(key)
    },
    async list<T>(options = {}) {
      const out = new Map<string, T>()
      for (const [k, v] of map) {
        if (options.prefix && !k.startsWith(options.prefix)) continue
        out.set(k, v as T)
        if (options.limit && out.size >= options.limit) break
      }
      return out
    },
    async getAlarm() {
      return s._alarm
    },
    async setAlarm(wakeAt) {
      s._alarm = wakeAt
      s._alarmCalls += 1
    },
    async deleteAlarm() {
      s._alarm = null
      s._deleteAlarmCalls += 1
    },
  }
  return s
}

/**
 * A ServiceBindingLike whose `fetch` calls the in-process step handler
 * directly — exercises the full handler→executor round trip without
 * any real HTTP transport.
 */
function inProcessBinding(): ServiceBindingLike {
  return {
    async fetch(req: Request): Promise<Response> {
      const body = await req.json()
      const out = await handleStepRequest(body)
      return new Response(JSON.stringify(out.body), {
        status: out.status,
        headers: { "content-type": "application/json" },
      })
    },
  }
}

/**
 * A DurableObjectNamespace-like that routes to a single in-memory DO
 * instance per name. Tests normally hit one run id, so one DO per
 * name is plenty.
 */
function inProcessRunDONamespace(): DurableObjectNamespaceLike<string> & {
  _storages: Map<string, DurableObjectStorageLike>
} {
  const storages = new Map<string, DurableObjectStorageLike>()
  const binding = inProcessBinding()
  return {
    _storages: storages,
    idFromName(name) {
      return name
    },
    get(id: string) {
      let storage = storages.get(id)
      if (!storage) {
        storage = makeStorage()
        storages.set(id, storage)
      }
      return {
        async fetch(req: Request): Promise<Response> {
          return handleDurableObjectRequest(req, {
            storage: storage!,
            dispatcher: createServiceBindingDispatcher({ binding }),
          })
        },
      }
    },
  }
}

const tenantMeta = {
  tenantId: "tnt_t",
  projectId: "prj_t",
  organizationId: "org_t",
  tenantScript: "tenant-worker-a",
}

beforeEach(() => {
  __resetRegistry()
})

// ---- createDurableObjectRunStore ----

describe("createDurableObjectRunStore", () => {
  it("round-trips a RunRecord via DO storage", async () => {
    const storage = makeStorage()
    const store = createDurableObjectRunStore(storage)
    const rec: RunRecord = {
      id: "run_1",
      workflowId: "wf",
      workflowVersion: "v1",
      status: "completed",
      input: { n: 1 },
      output: { ok: true },
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      invocationCount: 1,
      metadataAppliedCount: 0,
      computeTimeMs: 0,
      pendingWaitpoints: [],
      streams: {},
      startedAt: 100,
      completedAt: 200,
      triggeredBy: { kind: "api" },
      tags: [],
      environment: "development",
      tenantMeta,
      runMeta: { number: 1, attempt: 1 },
    }
    await store.save(rec)
    expect(await store.get("run_1")).toEqual(rec)
    expect(await store.get("run_other")).toBeUndefined()
    const list = await store.list()
    expect(list).toHaveLength(1)
    const filtered = await store.list({ status: "failed" })
    expect(filtered).toHaveLength(0)
  })
})

// ---- createServiceBindingDispatcher ----

describe("createServiceBindingDispatcher", () => {
  it("posts the WorkflowStepRequest as JSON and parses the response", async () => {
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })
    const binding = inProcessBinding()
    const handler = createServiceBindingDispatcher({ binding })({})
    const out = await handler({
      protocolVersion: 1,
      runId: "run_x",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(200)
    if (out.status === 200) {
      expect("output" in out.body && out.body.output).toBe(1)
    }
  })

  it("maps non-200 step responses to error envelopes", async () => {
    // No workflow registered → step handler returns 404.
    const binding = inProcessBinding()
    const handler = createServiceBindingDispatcher({ binding })({})
    const out = await handler({
      protocolVersion: 1,
      runId: "run_x",
      workflowId: "nope",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(404)
    expect("error" in out.body && out.body.error).toBe("workflow_not_found")
  })

  it("attaches a dispatch-auth header when a signer is provided", async () => {
    let capturedAuthHeader: string | null = null
    const binding: ServiceBindingLike = {
      async fetch(req) {
        capturedAuthHeader = req.headers.get("x-voyant-dispatch-auth")
        return new Response(JSON.stringify({ status: "completed", output: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      },
    }
    const handler = createServiceBindingDispatcher({
      binding,
      sign: (body) => `sig:${body.length}`,
    })({})
    await handler({
      protocolVersion: 1,
      runId: "run_x",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(capturedAuthHeader).toMatch(/^sig:\d+$/)
  })
})

// ---- handleWorkerRequest end-to-end ----

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

// ---- DO alarms for ctx.sleep (DATETIME waitpoints) ----

import { handleDurableObjectAlarm } from "../index.js"

describe("DO alarms + handleDurableObjectAlarm", () => {
  it("schedules an alarm when a run parks on ctx.sleep()", async () => {
    workflow<void, { done: true }>({
      id: "sleepy",
      async run(_i, ctx) {
        await ctx.sleep("10s")
        return { done: true }
      },
    })
    const storage = makeStorage()
    const t0 = 1_000_000
    const resp = await handleDurableObjectRequest(
      new Request("https://do-internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "sleepy",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_sleep",
        }),
      }),
      {
        storage,
        dispatcher: createInlineDispatcher(async (req) => handleStepRequest(req)),
        now: () => t0,
      },
    )
    expect(resp.status).toBe(200)
    // An alarm was scheduled at t0 + 10_000.
    expect(storage._alarm).toBe(t0 + 10_000)
    expect(storage._alarmCalls).toBe(1)
  })

  it("firing the alarm resolves the sleep and drives the run to completion", async () => {
    workflow<void, { done: true }>({
      id: "sleepy",
      async run(_i, ctx) {
        await ctx.sleep("10s")
        return { done: true }
      },
    })
    const storage = makeStorage()
    const t0 = 1_000_000
    await handleDurableObjectRequest(
      new Request("https://do-internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "sleepy",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_sleep2",
        }),
      }),
      {
        storage,
        dispatcher: createInlineDispatcher(async (req) => handleStepRequest(req)),
        now: () => t0,
      },
    )

    // Now fire the alarm at t0 + 10_000 + a bit.
    await handleDurableObjectAlarm({
      storage,
      dispatcher: createInlineDispatcher(async (req) => handleStepRequest(req)),
      now: () => t0 + 10_500,
    })

    const getResp = await handleDurableObjectRequest(
      new Request("https://do-internal/get", { method: "GET" }),
      {
        storage,
        dispatcher: createInlineDispatcher(async (req) => handleStepRequest(req)),
        now: () => t0 + 10_500,
      },
    )
    expect(getResp.status).toBe(200)
    const record = (await getResp.json()) as { status: string; output: unknown }
    expect(record.status).toBe("completed")
    expect(record.output).toEqual({ done: true })
    // Alarm cleared once the run is terminal.
    expect(storage._alarm).toBeNull()
  })

  it("reschedules after a wake if the body hits another sleep", async () => {
    workflow<void, { done: true }>({
      id: "twosleeps",
      async run(_i, ctx) {
        await ctx.sleep("10s")
        await ctx.sleep("5s")
        return { done: true }
      },
    })
    const storage = makeStorage()
    let clock = 1_000_000
    const deps = {
      storage,
      dispatcher: createInlineDispatcher(
        async (req: import("@voyantjs/workflows-orchestrator").WorkflowStepRequest) =>
          handleStepRequest(req),
      ),
      now: () => clock,
    }
    await handleDurableObjectRequest(
      new Request("https://do-internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "twosleeps",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_twosleep",
        }),
      }),
      deps,
    )
    expect(storage._alarm).toBe(clock + 10_000)

    clock += 10_500
    await handleDurableObjectAlarm(deps)
    // After the first sleep resolves, the body hits a 5s sleep → new alarm.
    expect(storage._alarm).toBe(clock + 5_000)

    clock += 5_500
    await handleDurableObjectAlarm(deps)
    expect(storage._alarm).toBeNull()

    const getResp = await handleDurableObjectRequest(
      new Request("https://do-internal/get", { method: "GET" }),
      deps,
    )
    const record = (await getResp.json()) as { status: string; output: unknown }
    expect(record.status).toBe("completed")
    expect(record.output).toEqual({ done: true })
  })

  it("does nothing for spurious alarms before the wake time", async () => {
    workflow<void, unknown>({
      id: "sleepz",
      async run(_i, ctx) {
        await ctx.sleep("30s")
        return 1
      },
    })
    const storage = makeStorage()
    let clock = 1_000_000
    const deps = {
      storage,
      dispatcher: createInlineDispatcher(
        async (req: import("@voyantjs/workflows-orchestrator").WorkflowStepRequest) =>
          handleStepRequest(req),
      ),
      now: () => clock,
    }
    await handleDurableObjectRequest(
      new Request("https://do-internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "sleepz",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_spur",
        }),
      }),
      deps,
    )
    const scheduledAt = storage._alarm
    // Fire the alarm 1ms before the wake time.
    clock += 29_999
    await handleDurableObjectAlarm(deps)
    // Still parked, same alarm scheduled.
    expect(storage._alarm).toBe(scheduledAt)
  })

  it("clears the alarm when a parked run is cancelled", async () => {
    workflow<void, unknown>({
      id: "cancelme",
      async run(_i, ctx) {
        await ctx.sleep("1h")
        return 1
      },
    })
    const storage = makeStorage()
    const deps = {
      storage,
      dispatcher: createInlineDispatcher(
        async (req: import("@voyantjs/workflows-orchestrator").WorkflowStepRequest) =>
          handleStepRequest(req),
      ),
    }
    await handleDurableObjectRequest(
      new Request("https://do-internal/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "cancelme",
          workflowVersion: "v1",
          input: null,
          tenantMeta,
          runId: "run_cancel",
        }),
      }),
      deps,
    )
    expect(storage._alarm).not.toBeNull()
    await handleDurableObjectRequest(
      new Request("https://do-internal/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "nope" }),
      }),
      deps,
    )
    expect(storage._alarm).toBeNull()
  })
})

// ---- HMAC auth: orchestrator signs, tenant handler verifies ----

import { createHmacSigner, createHmacVerifier } from "@voyantjs/workflows/auth"
import { createStepHandler } from "@voyantjs/workflows/handler"

describe("HMAC auth end-to-end", () => {
  const SECRET = "shared-dev-secret-rotate-in-prod"

  /**
   * Dispatcher that routes requests into a fetch-style tenant step
   * handler wired with `createHmacVerifier`. This lets us exercise the
   * full signer/verifier pair over a Request round-trip.
   */
  function signingBinding(tenantHandler: (req: Request) => Promise<Response>): ServiceBindingLike {
    return {
      async fetch(req: Request): Promise<Response> {
        return tenantHandler(req)
      },
    }
  }

  it("signed requests verify and the workflow runs to completion", async () => {
    workflow({
      id: "wf",
      async run() {
        return { ok: true }
      },
    })
    const sign = await createHmacSigner(SECRET)
    const verify = await createHmacVerifier(SECRET)
    const tenantFetch = createStepHandler({ verifyRequest: verify })

    const handler = createServiceBindingDispatcher({
      binding: signingBinding(tenantFetch),
      sign,
    })({})

    const out = await handler({
      protocolVersion: 1,
      runId: "run_auth",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(200)
    if (out.status === 200) {
      expect("output" in out.body && out.body.output).toEqual({ ok: true })
    }
  })

  it("a mismatched key fails verification with HTTP 401 from the tenant", async () => {
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })
    const sign = await createHmacSigner("secret-A")
    const verify = await createHmacVerifier("secret-B")
    const tenantFetch = createStepHandler({ verifyRequest: verify })

    const handler = createServiceBindingDispatcher({
      binding: signingBinding(tenantFetch),
      sign,
    })({})

    const out = await handler({
      protocolVersion: 1,
      runId: "run_bad_auth",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(401)
    expect("error" in out.body && out.body.error).toBe("unauthorized")
  })

  it("unsigned requests fail when the tenant has a verifier", async () => {
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })
    const verify = await createHmacVerifier(SECRET)
    const tenantFetch = createStepHandler({ verifyRequest: verify })

    // No signer on the orchestrator side.
    const handler = createServiceBindingDispatcher({
      binding: signingBinding(tenantFetch),
    })({})

    const out = await handler({
      protocolVersion: 1,
      runId: "run_no_sig",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(401)
    if ("message" in out.body) {
      expect(out.body.message).toMatch(/missing .* header/)
    }
  })
})
