import { FatalError } from "@voyantjs/workflows/errors"
import { beforeEach, describe, expect, it } from "vitest"
import { runWorkflowForTest } from "../../testing/index.js"
import { __resetRegistry, workflow } from "../../workflow.js"

beforeEach(() => {
  __resetRegistry()
})

describe("happy path", () => {
  it("does not run compensate fns when the body completes normally", async () => {
    const compensated: string[] = []

    const wf = workflow<void, string>({
      id: "comp.happy",
      async run(_, ctx) {
        await ctx.step(
          "a",
          {
            compensate: async () => {
              compensated.push("a")
            },
          },
          async () => "a-done",
        )
        await ctx.step(
          "b",
          {
            compensate: async () => {
              compensated.push("b")
            },
          },
          async () => "b-done",
        )
        return "ok"
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("ok")
    expect(compensated).toEqual([])
    expect(result.compensations).toEqual([])
  })
})

describe("rollback on uncaught body error", () => {
  it("runs compensations in reverse completion order", async () => {
    const order: string[] = []

    const wf = workflow<void, void>({
      id: "comp.reverse",
      async run(_, ctx) {
        await ctx.step(
          "a",
          {
            compensate: async () => {
              order.push("undo-a")
            },
          },
          async () => "A",
        )
        await ctx.step(
          "b",
          {
            compensate: async () => {
              order.push("undo-b")
            },
          },
          async () => "B",
        )
        await ctx.step(
          "c",
          {
            compensate: async () => {
              order.push("undo-c")
            },
          },
          async () => "C",
        )
        throw new Error("boom after c")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("compensated")
    expect(order).toEqual(["undo-c", "undo-b", "undo-a"])
    expect(result.compensations.map((c) => c.stepId)).toEqual(["c", "b", "a"])
    expect(result.compensations.every((c) => c.status === "ok")).toBe(true)
    expect(result.error?.message).toBe("boom after c")
  })

  it("passes each step's original output to its compensate fn", async () => {
    const seen: Record<string, unknown> = {}

    const wf = workflow<void, void>({
      id: "comp.output",
      async run(_, ctx) {
        await ctx.step(
          "reserve",
          {
            compensate: async (output: { reservationId: string }) => {
              seen.reserve = output
            },
          },
          async () => ({ reservationId: "res_123" }),
        )
        throw new Error("abort")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("compensated")
    expect(seen.reserve).toEqual({ reservationId: "res_123" })
  })

  it("skips steps that had no compensate declared", async () => {
    const compensated: string[] = []

    const wf = workflow<void, void>({
      id: "comp.skip",
      async run(_, ctx) {
        await ctx.step("a", async () => "A") // no compensate
        await ctx.step(
          "b",
          {
            compensate: async () => {
              compensated.push("b")
            },
          },
          async () => "B",
        )
        await ctx.step("c", async () => "C") // no compensate
        throw new Error("fail")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("compensated")
    expect(compensated).toEqual(["b"])
    expect(result.compensations.map((c) => c.stepId)).toEqual(["b"])
  })

  it("marks the run failed when no compensations are registered", async () => {
    const wf = workflow<void, void>({
      id: "comp.none",
      async run(_, ctx) {
        await ctx.step("a", async () => "A")
        throw new Error("fail without comps")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("failed")
    expect(result.error?.message).toBe("fail without comps")
    expect(result.compensations).toEqual([])
  })

  it("continues running compensations when one fails, ending with compensation_failed", async () => {
    const ran: string[] = []

    const wf = workflow<void, void>({
      id: "comp.partial-fail",
      async run(_, ctx) {
        await ctx.step(
          "a",
          {
            compensate: async () => {
              ran.push("a")
            },
          },
          async () => "A",
        )
        await ctx.step(
          "b",
          {
            compensate: async () => {
              ran.push("b")
              throw new Error("b-undo exploded")
            },
          },
          async () => "B",
        )
        await ctx.step(
          "c",
          {
            compensate: async () => {
              ran.push("c")
            },
          },
          async () => "C",
        )
        throw new Error("trigger rollback")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("compensation_failed")
    // All three compensations ran in reverse order — b threw but c and a
    // still ran afterward.
    expect(ran).toEqual(["c", "b", "a"])
    expect(result.compensations.map((c) => [c.stepId, c.status])).toEqual([
      ["c", "ok"],
      ["b", "err"],
      ["a", "ok"],
    ])
    const bReport = result.compensations.find((c) => c.stepId === "b")!
    expect(bReport.error?.message).toBe("b-undo exploded")
  })
})

describe("FatalError triggers rollback", () => {
  it("compensates when the body rethrows a FatalError", async () => {
    const compensated: string[] = []

    const wf = workflow<void, void>({
      id: "comp.fatal",
      async run(_, ctx) {
        await ctx.step(
          "reserve",
          {
            compensate: async () => {
              compensated.push("release")
            },
          },
          async () => "ok",
        )
        await ctx.step("charge", async () => {
          throw new FatalError("card declined")
        })
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("compensated")
    expect(compensated).toEqual(["release"])
    expect(result.error?.message).toBe("card declined")
    expect(result.error?.code).toBe("FATAL")
  })
})

describe("explicit ctx.compensate()", () => {
  it("triggers rollback without throwing a user error", async () => {
    const compensated: string[] = []

    const wf = workflow<{ shouldAbort: boolean }, string>({
      id: "comp.explicit",
      async run(input, ctx) {
        await ctx.step(
          "a",
          {
            compensate: async () => {
              compensated.push("undo-a")
            },
          },
          async () => "A",
        )
        if (input.shouldAbort) {
          await ctx.compensate()
        }
        return "completed"
      },
    })

    const result = await runWorkflowForTest(wf, { shouldAbort: true })

    expect(result.status).toBe("compensated")
    expect(compensated).toEqual(["undo-a"])
    // No user error was thrown — the rollback was intentional.
    expect(result.error).toBeUndefined()
  })

  it("does not run when the body takes the non-abort branch", async () => {
    const compensated: string[] = []

    const wf = workflow<{ shouldAbort: boolean }, string>({
      id: "comp.explicit-noabort",
      async run(input, ctx) {
        await ctx.step(
          "a",
          {
            compensate: async () => {
              compensated.push("undo-a")
            },
          },
          async () => "A",
        )
        if (input.shouldAbort) {
          await ctx.compensate()
        }
        return "completed"
      },
    })

    const result = await runWorkflowForTest(wf, { shouldAbort: false })

    expect(result.status).toBe("completed")
    expect(result.output).toBe("completed")
    expect(compensated).toEqual([])
  })
})
