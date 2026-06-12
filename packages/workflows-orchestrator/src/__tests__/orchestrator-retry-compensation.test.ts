import { workflow } from "@voyantjs/workflows"
import { describe, expect, it } from "vitest"
import { createInMemoryRunStore, trigger } from "../index.js"
import { handler, tenantMeta } from "./orchestrator-test-support.js"

describe("retry policies", () => {
  it("retries a failing step until it succeeds", async () => {
    let attempts = 0
    workflow<void, { total: number; attempts: number }>({
      id: "retry-success",
      async run(_i, ctx) {
        const total = await ctx.step(
          "flaky",
          { retry: { max: 3, backoff: "fixed", initial: 1 } },
          async () => {
            attempts += 1
            if (attempts < 3) throw new Error("transient")
            return 42
          },
        )
        return { total, attempts }
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "retry-success", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("completed")
    expect(rec.output).toEqual({ total: 42, attempts: 3 })
    // The journal records the final successful attempt.
    expect(rec.journal.stepResults.flaky?.attempt).toBe(3)
  })

  it("fails the run when retries are exhausted", async () => {
    workflow<void, unknown>({
      id: "retry-exhausted",
      async run(_i, ctx) {
        await ctx.step(
          "always-fails",
          { retry: { max: 2, backoff: "fixed", initial: 1 } },
          async () => {
            throw new Error("permanent")
          },
        )
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "retry-exhausted", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("failed")
    expect(rec.error?.message).toBe("permanent")
  })
})

describe("ctx.setRetry — dynamic policy override", () => {
  it("applies the override to subsequent steps with no step-level policy", async () => {
    let attempts = 0
    workflow<void, number>({
      id: "setretry",
      async run(_i, ctx) {
        ctx.setRetry({ max: 4, backoff: "fixed", initial: 1 })
        return await ctx.step("flaky", async () => {
          attempts += 1
          if (attempts < 4) throw new Error("not yet")
          return attempts
        })
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "setretry", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("completed")
    expect(rec.output).toBe(4)
  })
})

describe("ctx.compensate() — explicit compensation", () => {
  it("runs registered compensations LIFO when called", async () => {
    const log: string[] = []
    workflow<void, unknown>({
      id: "compensate-explicit",
      async run(_i, ctx) {
        await ctx.step(
          "reserve",
          {
            compensate: async () => {
              log.push("unreserve")
            },
          },
          async () => "r",
        )
        await ctx.step(
          "charge",
          {
            compensate: async () => {
              log.push("refund")
            },
          },
          async () => "c",
        )
        // Some business reason to roll back, not an exception.
        await ctx.compensate()
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "compensate-explicit", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("compensated")
    expect(log).toEqual(["refund", "unreserve"])
  })

  it("propagates a compensation error as status compensation_failed", async () => {
    workflow<void, unknown>({
      id: "compensate-fails",
      async run(_i, ctx) {
        await ctx.step(
          "reserve",
          {
            compensate: async () => {
              throw new Error("unreserve exploded")
            },
          },
          async () => "r",
        )
        await ctx.compensate()
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "compensate-fails", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("compensation_failed")
  })
})

describe("ctx.group() — scoped compensation", () => {
  it("rolls back only the group's compensables when the group body throws + is caught", async () => {
    const log: string[] = []
    workflow<void, string>({
      id: "group-caught",
      async run(_i, ctx) {
        await ctx.step(
          "outer",
          {
            compensate: async () => {
              log.push("undo-outer")
            },
          },
          async () => 1,
        )
        try {
          await ctx.group("txn", async (scope) => {
            await scope.step(
              "inner-a",
              {
                compensate: async () => {
                  log.push("undo-inner-a")
                },
              },
              async () => 2,
            )
            await scope.step(
              "inner-b",
              {
                compensate: async () => {
                  log.push("undo-inner-b")
                },
              },
              async () => 3,
            )
            throw new Error("group broke")
          })
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
        return "unreached"
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "group-caught", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("completed")
    expect(rec.output).toBe("caught: group broke")
    // Only the two inner compensations ran, in reverse order. Outer
    // stays intact because the parent body caught the error.
    expect(log).toEqual(["undo-inner-b", "undo-inner-a"])
  })

  it("scope.compensate() rolls back the scope and propagates to outer", async () => {
    const log: string[] = []
    workflow<void, unknown>({
      id: "group-propagate",
      async run(_i, ctx) {
        await ctx.step(
          "outer",
          {
            compensate: async () => {
              log.push("undo-outer")
            },
          },
          async () => 1,
        )
        await ctx.group("txn", async (scope) => {
          await scope.step(
            "inner",
            {
              compensate: async () => {
                log.push("undo-inner")
              },
            },
            async () => 2,
          )
          await scope.compensate()
        })
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "group-propagate", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("compensated")
    // Inner runs first (LIFO within scope), then outer.
    expect(log).toEqual(["undo-inner", "undo-outer"])
  })
})
