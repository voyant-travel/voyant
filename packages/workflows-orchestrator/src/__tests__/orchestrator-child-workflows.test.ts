import { workflow } from "@voyantjs/workflows"
import { describe, expect, it } from "vitest"
import { cancel, createInMemoryRunStore, resume, trigger } from "../index.js"
import { handler, tenantMeta } from "./orchestrator-test-support.js"

describe("ctx.invoke — child workflows", () => {
  it("resolves a completed child's output as the RUN resolution on the parent", async () => {
    const add = workflow<{ a: number; b: number }, number>({
      id: "add",
      async run(input) {
        return input.a + input.b
      },
    })
    workflow<void, number>({
      id: "parent",
      async run(_i, ctx) {
        const sum = await ctx.invoke(add, { a: 3, b: 4 })
        return sum * 10
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "parent", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("completed")
    expect(rec.output).toBe(70)
    // Both parent + child were persisted.
    const all = await store.list()
    const ids = all.map((r) => r.workflowId).sort()
    expect(ids).toEqual(["add", "parent"])
  })

  it("surfaces a child failure on the parent via the RUN resolution's error field", async () => {
    const dies = workflow<void, never>({
      id: "dies",
      async run() {
        throw new Error("child boom")
      },
    })
    workflow<void, string>({
      id: "parent-catches",
      async run(_i, ctx) {
        try {
          await ctx.invoke(dies, undefined)
          return "unreached"
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "parent-catches", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("completed")
    expect(rec.output).toBe("caught: child boom")
    // Child run is persisted with its own failed status.
    const children = await store.list({ workflowId: "dies" })
    expect(children).toHaveLength(1)
    expect(children[0]!.status).toBe("failed")
  })

  it("runs multiple sequential invokes, each resolving before the next starts", async () => {
    const square = workflow<{ n: number }, number>({
      id: "square",
      async run(input) {
        return input.n * input.n
      },
    })
    workflow<void, number[]>({
      id: "seq-parent",
      async run(_i, ctx) {
        const a = await ctx.invoke(square, { n: 3 })
        const b = await ctx.invoke(square, { n: 4 })
        const c = await ctx.invoke(square, { n: 5 })
        return [a, b, c]
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "seq-parent", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("completed")
    expect(rec.output).toEqual([9, 16, 25])
    const children = await store.list({ workflowId: "square" })
    expect(children).toHaveLength(3)
  })

  it("parent parks on a parked child; resuming the child cascade-resumes the parent", async () => {
    const needsApproval = workflow<{ token: string }, string>({
      id: "needs-approval",
      async run(input, ctx) {
        const decision = await ctx.waitForEvent<{ ok: boolean }>("approve")
        return decision?.ok ? `ok:${input.token}` : "rejected"
      },
    })
    workflow<void, string>({
      id: "invokes-approval",
      async run(_i, ctx) {
        const child = await ctx.invoke(needsApproval, { token: "abc" })
        return `parent saw: ${child}`
      },
    })
    const store = createInMemoryRunStore()
    const deps = { store, handler }
    const parent = await trigger(
      {
        workflowId: "invokes-approval",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_parent",
      },
      deps,
    )
    // Parent parks because its child parked.
    expect(parent.status).toBe("waiting")
    expect(parent.pendingWaitpoints.some((w) => w.kind === "RUN")).toBe(true)

    // The child is a separate record, parked on EVENT, with parent pointer.
    const children = await store.list({ workflowId: "needs-approval" })
    expect(children).toHaveLength(1)
    const child = children[0]!
    expect(child.status).toBe("waiting")
    expect(child.parent?.runId).toBe("run_parent")

    // Resume the child → cascade completes the parent.
    const out = await resume(
      {
        runId: child.id,
        injection: { kind: "EVENT", eventType: "approve", payload: { ok: true } },
      },
      deps,
    )
    expect(out.ok).toBe(true)

    const finalParent = await store.get("run_parent")
    expect(finalParent?.status).toBe("completed")
    expect(finalParent?.output).toBe("parent saw: ok:abc")
  })

  it("detached child runs do not park or later resume the parent", async () => {
    const needsApproval = workflow<{ token: string }, string>({
      id: "needs-approval-detached",
      async run(input, ctx) {
        const decision = await ctx.waitForEvent<{ ok: boolean }>("approve")
        return decision?.ok ? `ok:${input.token}` : "rejected"
      },
    })
    workflow<void, string>({
      id: "invokes-approval-detached",
      async run(_i, ctx) {
        await ctx.invoke(needsApproval, { token: "abc" }, { detach: true })
        return "parent continued"
      },
    })
    const store = createInMemoryRunStore()
    const deps = { store, handler }
    const parent = await trigger(
      {
        workflowId: "invokes-approval-detached",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_parent_detached",
      },
      deps,
    )

    expect(parent.status).toBe("completed")
    expect(parent.output).toBe("parent continued")
    expect(parent.pendingWaitpoints).toHaveLength(0)

    const children = await store.list({ workflowId: "needs-approval-detached" })
    expect(children).toHaveLength(1)
    const child = children[0]!
    expect(child.status).toBe("waiting")
    expect(child.parent).toBeUndefined()

    const resumed = await resume(
      {
        runId: child.id,
        injection: { kind: "EVENT", eventType: "approve", payload: { ok: true } },
      },
      deps,
    )
    expect(resumed.ok).toBe(true)

    const finalParent = await store.get("run_parent_detached")
    expect(finalParent?.status).toBe("completed")
    expect(finalParent?.output).toBe("parent continued")
  })

  it("detached child failures do not fail the parent", async () => {
    const dies = workflow<void, never>({
      id: "child-detached-fails",
      async run(): Promise<never> {
        throw new Error("detached boom")
      },
    })
    workflow<void, string>({
      id: "parent-ignores-detached-failure",
      async run(_i, ctx) {
        await ctx.invoke(dies, undefined, { detach: true })
        return "still ok"
      },
    })

    const store = createInMemoryRunStore()
    const rec = await trigger(
      {
        workflowId: "parent-ignores-detached-failure",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
      },
      { store, handler },
    )

    expect(rec.status).toBe("completed")
    expect(rec.output).toBe("still ok")

    const children = await store.list({ workflowId: "child-detached-fails" })
    expect(children).toHaveLength(1)
    expect(children[0]?.status).toBe("failed")
    expect(children[0]?.parent).toBeUndefined()
  })

  it("cancelling a child surfaces the cancel on the parent's RUN waitpoint", async () => {
    const slowChild = workflow<void, unknown>({
      id: "slow-child",
      async run(_i, ctx) {
        return await ctx.waitForEvent("never")
      },
    })
    workflow<void, string>({
      id: "catches-child-cancel",
      async run(_i, ctx) {
        try {
          await ctx.invoke(slowChild, undefined)
          return "unreached"
        } catch (err) {
          return `caught: ${(err as Error).message}`
        }
      },
    })
    const store = createInMemoryRunStore()
    const deps = { store, handler }
    await trigger(
      {
        workflowId: "catches-child-cancel",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_catch",
      },
      deps,
    )
    const children = await store.list({ workflowId: "slow-child" })
    expect(children).toHaveLength(1)
    const child = children[0]!
    await cancel({ runId: child.id, reason: "ops aborted" }, deps)

    const finalParent = await store.get("run_catch")
    expect(finalParent?.status).toBe("completed")
    expect(finalParent?.output).toMatch(/caught: ops aborted|caught: .*cancel/i)
  })

  it("fails with guidance when the driver has no triggerChild hook", async () => {
    const child = workflow<void, number>({
      id: "ch",
      async run() {
        return 1
      },
    })
    workflow<void, number>({
      id: "orphan",
      async run(_i, ctx) {
        return await ctx.invoke(child, undefined)
      },
    })
    // Use driveUntilPaused directly without a triggerChild wiring.
    const { driveUntilPaused } = await import("../drive.js")
    const record = {
      id: "run_orphan",
      workflowId: "orphan",
      workflowVersion: "v1",
      status: "running" as const,
      input: undefined,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      invocationCount: 0,
      metadataAppliedCount: 0,
      computeTimeMs: 0,
      pendingWaitpoints: [],
      streams: {},
      startedAt: 0,
      triggeredBy: { kind: "api" as const },
      tags: [],
      environment: "development" as const,
      tenantMeta,
      runMeta: { number: 1, attempt: 1 },
    }
    await driveUntilPaused(record, { handler })
    expect(record.status).toBe("failed")
    expect(record.error?.code).toBe("child_runs_unsupported")
  })
})
