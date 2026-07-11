import { workflow } from "@voyant-travel/workflows"
import { handleStepRequest } from "@voyant-travel/workflows/handler"
import { describe, expect, it } from "vitest"
import { cancel, createInMemoryRunStore, resume, type StepHandler, trigger } from "../index.js"
import { handler, tenantMeta, workflowResolver } from "./orchestrator-test-support.js"

describe("workflow-level timeout", () => {
  it("fails a run that exceeds its compute-time budget across invocations", async () => {
    // Each invocation parks on a waitpoint we inject externally, and
    // advances compute time via an injected clock. Third invocation
    // is the one over-budget; the fourth shouldn't run.
    workflow<void, unknown>({
      id: "timeout-run",
      async run(_i, ctx) {
        await ctx.waitForEvent("a")
        await ctx.waitForEvent("b")
        await ctx.waitForEvent("c")
        return "done"
      },
    })
    let clock = 0
    const store = createInMemoryRunStore()
    const advancingHandler: StepHandler = async (req, opts) => {
      // Each invocation costs 400ms of compute time.
      clock += 400
      return await handleStepRequest(req, { workflowResolver }, opts)
    }
    const deps = {
      store,
      handler: advancingHandler,
      now: () => clock,
    }
    const parked = await trigger(
      {
        workflowId: "timeout-run",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_budget",
        timeoutMs: 1000, // budget of 1s → after 3 invocations (1.2s used) we bust
      },
      deps,
    )
    expect(parked.status).toBe("waiting")
    expect(parked.computeTimeMs).toBe(400)

    await resume({ runId: "run_budget", injection: { kind: "EVENT", eventType: "a" } }, deps)
    await resume({ runId: "run_budget", injection: { kind: "EVENT", eventType: "b" } }, deps)
    // Next resume would push compute time past 1000ms; drive should
    // refuse to invoke and mark failed.
    const out = await resume(
      { runId: "run_budget", injection: { kind: "EVENT", eventType: "c" } },
      deps,
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.record.status).toBe("failed")
      expect(out.record.error?.code).toBe("WORKFLOW_TIMEOUT")
    }
  })

  it("does not count parked time against the budget", async () => {
    workflow<void, number>({
      id: "parked-cheap",
      async run(_i, ctx) {
        await ctx.waitForEvent("go")
        return 1
      },
    })
    let clock = 0
    const cheapHandler: StepHandler = async (req, opts) => {
      clock += 50 // each invocation costs 50ms
      return await handleStepRequest(req, { workflowResolver }, opts)
    }
    const store = createInMemoryRunStore()
    const deps = { store, handler: cheapHandler, now: () => clock }
    await trigger(
      {
        workflowId: "parked-cheap",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_parked_budget",
        timeoutMs: 200,
      },
      deps,
    )
    // Simulate "a week later" by advancing wall-clock without calling anything.
    clock += 7 * 24 * 60 * 60 * 1000
    const out = await resume(
      { runId: "run_parked_budget", injection: { kind: "EVENT", eventType: "go" } },
      deps,
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      // Total compute ≈ 100ms (50ms × 2 invocations) — well under 200ms.
      expect(out.record.status).toBe("completed")
      expect(out.record.output).toBe(1)
    }
  })
})

describe("idempotent trigger", () => {
  it("returns the existing run when an explicit runId is re-triggered", async () => {
    let runs = 0
    workflow<void, number>({
      id: "once",
      async run() {
        runs += 1
        return runs
      },
    })
    const store = createInMemoryRunStore()
    const first = await trigger(
      { workflowId: "once", workflowVersion: "v1", input: undefined, tenantMeta, runId: "idem_1" },
      { store, handler },
    )
    expect(first.output).toBe(1)
    // Second trigger with same runId returns the first record, no re-execution.
    const second = await trigger(
      { workflowId: "once", workflowVersion: "v1", input: undefined, tenantMeta, runId: "idem_1" },
      { store, handler },
    )
    expect(second).toEqual(first)
    expect(runs).toBe(1)
  })

  it("auto-generated runIds still produce distinct runs for repeat triggers", async () => {
    workflow<void, number>({
      id: "distinct",
      async run() {
        return 1
      },
    })
    const store = createInMemoryRunStore()
    const a = await trigger(
      { workflowId: "distinct", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    const b = await trigger(
      { workflowId: "distinct", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(a.id).not.toBe(b.id)
  })
})

describe("cancel during drive", () => {
  it("stops the drive loop if the run was cancelled between invocations", async () => {
    // A workflow that does two sequential invokes. We fire cancel()
    // between them by wiring a handler that concurrently cancels
    // before returning from the first child's trigger.
    const child = workflow<void, number>({
      id: "cancel-child",
      async run() {
        return 1
      },
    })
    workflow<void, number[]>({
      id: "cancel-parent",
      async run(_i, ctx) {
        const a = await ctx.invoke(child, undefined)
        const b = await ctx.invoke(child, undefined)
        return [a, b]
      },
    })
    const store = createInMemoryRunStore()
    let cancelFired = false
    const wrappedHandler: StepHandler = async (req) => {
      const out = await handleStepRequest(req, { workflowResolver })
      // After the FIRST invocation completes, fire a cancel from
      // outside the drive loop. The second invocation must not run.
      if (!cancelFired && req.runId === "run_parent_cancel") {
        cancelFired = true
        await cancel(
          { runId: "run_parent_cancel", reason: "user requested" },
          { store, handler: wrappedHandler },
        )
      }
      return out
    }
    const rec = await trigger(
      {
        workflowId: "cancel-parent",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_parent_cancel",
      },
      { store, handler: wrappedHandler },
    )
    expect(rec.status).toBe("cancelled")
    expect(rec.error?.message).toBe("user requested")
    // The parent ran at most one invocation — the second was skipped
    // because the drive's beforeInvocation hook saw the cancelled
    // status in the store.
    expect(rec.invocationCount).toBeLessThanOrEqual(1)
  })

  it("aborts an in-flight step body via ctx.signal", async () => {
    // A step that waits on an AbortSignal-respecting sleep. Cancel
    // fires while the step is mid-flight; the sleep rejects with
    // AbortError, surfaces as a step error, and the run ends
    // `failed` (since the step doesn't catch + explicitly cancel).
    workflow<void, unknown>({
      id: "long-step",
      async run(_i, ctx) {
        await ctx.step("hold", async (stepCtx) => {
          await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, 10_000)
            stepCtx.signal.addEventListener("abort", () => {
              clearTimeout(t)
              reject(new Error("aborted-by-signal"))
            })
          })
        })
      },
    })
    const store = createInMemoryRunStore()
    const deps = { store, handler }
    const runP = trigger(
      {
        workflowId: "long-step",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_midstep",
      },
      deps,
    )
    // Give the step body time to enter its sleep before we cancel.
    await new Promise((r) => setTimeout(r, 20))
    await cancel({ runId: "run_midstep", reason: "user requested" }, deps)
    const rec = await runP
    // The cancel's store update wins on the next `beforeInvocation`
    // check after the aborted step returns, so the final status is
    // "cancelled", not "failed".
    expect(rec.status).toBe("cancelled")
    expect(rec.error?.message).toBe("user requested")
  })

  it("persists the record up-front so concurrent cancel() finds it", async () => {
    // Before this change, cancel() saw `not_found` for runs that
    // hadn't yet finished their first invocation and thus hadn't been
    // saved. Now every trigger writes the record immediately.
    workflow<void, number>({
      id: "slow",
      async run() {
        return 1
      },
    })
    const store = createInMemoryRunStore()
    const handlerAfterSave: StepHandler = async (req) => {
      // By the time the handler is called, the record must already be
      // in the store (trigger saves up-front).
      const found = await store.get(req.runId)
      expect(found).toBeDefined()
      return handleStepRequest(req, { workflowResolver })
    }
    await trigger(
      {
        workflowId: "slow",
        workflowVersion: "v1",
        input: undefined,
        tenantMeta,
        runId: "run_presaved",
      },
      { store, handler: handlerAfterSave },
    )
  })
})
