import { workflow } from "@voyant-travel/workflows"
import { handleStepRequest } from "@voyant-travel/workflows/handler"
import { describe, expect, it } from "vitest"
import {
  createInlineDispatcher,
  handleDurableObjectAlarm,
  handleDurableObjectRequest,
} from "../index.js"
import { makeStorage, tenantMeta } from "./adapter-test-support.js"

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
        async (req: import("@voyant-travel/workflows-orchestrator").WorkflowStepRequest) =>
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
        async (req: import("@voyant-travel/workflows-orchestrator").WorkflowStepRequest) =>
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
        async (req: import("@voyant-travel/workflows-orchestrator").WorkflowStepRequest) =>
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
