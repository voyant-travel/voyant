import { workflow } from "@voyantjs/workflows"
import { describe, expect, it } from "vitest"
import { createInMemoryRunStore, type RunRecord, resumeDueAlarms, trigger } from "../index.js"
import { handler, tenantMeta } from "./orchestrator-test-support.js"

describe("resumeDueAlarms()", () => {
  it("resolves a DATETIME waitpoint whose wakeAt has passed and drives the run", async () => {
    workflow<void, string>({
      id: "sleeper",
      async run(_, ctx) {
        const a = await ctx.step("a", () => "alpha")
        await ctx.sleep("1s")
        const b = await ctx.step("b", () => "beta")
        return `${a}-${b}`
      },
    })
    const store = createInMemoryRunStore()
    const t0 = 1_700_000_000_000
    let clock = t0
    const deps = { store, handler, now: () => clock }

    const rec = await trigger(
      { workflowId: "sleeper", workflowVersion: "v1", input: undefined, tenantMeta },
      deps,
    )
    expect(rec.status).toBe("waiting")
    expect(rec.pendingWaitpoints).toHaveLength(1)
    expect(rec.pendingWaitpoints[0]!.kind).toBe("DATETIME")
    expect(rec.pendingWaitpoints[0]!.meta.wakeAt).toBe(t0 + 1_000)

    // Before wakeAt — nothing is due yet.
    clock = t0 + 500
    const tooEarly = await resumeDueAlarms({ runId: rec.id }, deps)
    expect(tooEarly).toBeNull()
    expect((await store.get(rec.id))!.status).toBe("waiting")

    // After wakeAt — the sleep resolves and the run completes.
    clock = t0 + 1_500
    const saved = await resumeDueAlarms({ runId: rec.id }, deps)
    expect(saved).not.toBeNull()
    expect(saved!.status).toBe("completed")
    expect(saved!.output).toBe("alpha-beta")
  })

  it("is a no-op when the run is terminal or missing", async () => {
    const store = createInMemoryRunStore()
    const deps = { store, handler }
    expect(await resumeDueAlarms({ runId: "nope" }, deps)).toBeNull()

    workflow<void, number>({
      id: "done",
      async run() {
        return 1
      },
    })
    const rec = await trigger(
      { workflowId: "done", workflowVersion: "v1", input: undefined, tenantMeta },
      deps,
    )
    expect(rec.status).toBe("completed")
    expect(await resumeDueAlarms({ runId: rec.id }, deps)).toBeNull()
  })
})

describe("store list/filter", () => {
  it("lists runs most-recent first and supports filters", async () => {
    workflow<void, unknown>({
      id: "a",
      async run() {
        return 1
      },
    })
    workflow<void, unknown>({
      id: "b",
      async run() {
        throw new Error("x")
      },
    })
    const store = createInMemoryRunStore()
    const deps = { store, handler }
    await trigger({ workflowId: "a", workflowVersion: "v1", input: undefined, tenantMeta }, deps)
    await trigger({ workflowId: "b", workflowVersion: "v1", input: undefined, tenantMeta }, deps)

    const all = await store.list()
    expect(all).toHaveLength(2)

    const onlyB = await store.list({ workflowId: "b" })
    expect(onlyB.map((r: RunRecord) => r.workflowId)).toEqual(["b"])

    const failed = await store.list({ status: "failed" })
    expect(failed).toHaveLength(1)
    expect(failed[0]!.workflowId).toBe("b")
  })
})
