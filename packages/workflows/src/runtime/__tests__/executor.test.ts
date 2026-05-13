import { FatalError } from "@voyantjs/workflows/errors"
import { beforeEach, describe, expect, it } from "vitest"
import { runWorkflowForTest } from "../../testing/index.js"
import { __resetRegistry, workflow } from "../../workflow.js"

beforeEach(() => {
  __resetRegistry()
})

// ---------- Linear happy path ----------

describe("linear workflow", () => {
  it("completes in a single invocation when there are no waits", async () => {
    const wf = workflow<string, string>({
      id: "linear.no-waits",
      async run(input, ctx) {
        return await ctx.step("greet", () => `hello ${input}`)
      },
    })

    const result = await runWorkflowForTest(wf, "world")

    expect(result.status).toBe("completed")
    expect(result.output).toBe("hello world")
    expect(result.invocations).toBe(1)
    expect(result.steps).toEqual([
      expect.objectContaining({ id: "greet", status: "ok", output: "hello world" }),
    ])
  })

  it("chains multiple steps", async () => {
    const wf = workflow<number, number>({
      id: "linear.chain",
      async run(input, ctx) {
        const a = await ctx.step("a", () => input + 1)
        const b = await ctx.step("b", () => a * 2)
        const c = await ctx.step("c", () => b + 100)
        return c
      },
    })

    const result = await runWorkflowForTest(wf, 3)

    expect(result.status).toBe("completed")
    expect(result.output).toBe(108) // ((3 + 1) * 2) + 100
    expect(result.steps.map((s) => s.id)).toEqual(["a", "b", "c"])
  })
})

// ---------- Sleep + replay ----------

describe("sleep-driven replay", () => {
  it("resumes across a single sleep", async () => {
    const wf = workflow<void, number>({
      id: "sleep.single",
      async run(_, ctx) {
        const a = await ctx.step("a", () => 1)
        await ctx.sleep("1h")
        const b = await ctx.step("b", () => 2)
        return a + b
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe(3)
    expect(result.invocations).toBe(2)
    expect(result.steps.map((s) => s.id)).toEqual(["a", "b"])
  })

  it("resumes across two sleeps", async () => {
    const wf = workflow<void, number>({
      id: "sleep.multi",
      async run(_, ctx) {
        const a = await ctx.step("a", () => 1)
        await ctx.sleep("1h")
        const b = await ctx.step("b", () => 2)
        await ctx.sleep("1h")
        const c = await ctx.step("c", () => 3)
        return a + b + c
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe(6)
    expect(result.invocations).toBe(3)
  })
})

// ---------- Waitpoints ----------

describe("waitForEvent", () => {
  it("resolves from fixture and resumes", async () => {
    const wf = workflow<void, number>({
      id: "event.basic",
      async run(_, ctx) {
        const p = await ctx.waitForEvent<{ n: number }>("bump")
        return p?.n ?? 0
      },
    })

    const result = await runWorkflowForTest(wf, undefined, {
      waitForEvent: { bump: { n: 42 } },
    })

    expect(result.status).toBe("completed")
    expect(result.output).toBe(42)
    expect(result.invocations).toBe(2)
  })

  it("throws when no fixture is provided", async () => {
    const wf = workflow<void, unknown>({
      id: "event.missing",
      async run(_, ctx) {
        return await ctx.waitForEvent("never-resolved")
      },
    })

    await expect(runWorkflowForTest(wf, undefined)).rejects.toThrow(/no fixture resolution/i)
  })
})

describe("waitForSignal", () => {
  it("resolves from fixture", async () => {
    const wf = workflow<void, boolean>({
      id: "signal.basic",
      async run(_, ctx) {
        const p = await ctx.waitForSignal<{ ok: boolean }>("go")
        return p?.ok ?? false
      },
    })

    const result = await runWorkflowForTest(wf, undefined, {
      waitForSignal: { go: { ok: true } },
    })

    expect(result.status).toBe("completed")
    expect(result.output).toBe(true)
  })
})

// ---------- Error paths ----------

describe("step errors", () => {
  it("propagates step throws as catchable errors in the body", async () => {
    const wf = workflow<void, string>({
      id: "err.caught",
      async run(_, ctx) {
        try {
          await ctx.step("bad", async () => {
            throw new Error("oops")
          })
          return "no-throw"
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("caught: oops")
    expect(result.steps[0]!.status).toBe("err")
  })

  it("propagates uncaught body errors as run failure", async () => {
    const wf = workflow<void, never>({
      id: "err.body",
      async run(): Promise<never> {
        throw new Error("boom")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("failed")
    expect(result.error?.message).toBe("boom")
    expect(result.error?.category).toBe("USER_ERROR")
  })

  it("handles FatalError thrown from a step", async () => {
    const wf = workflow<void, string>({
      id: "err.fatal",
      async run(_, ctx) {
        try {
          await ctx.step("bad", async () => {
            throw new FatalError("do not retry")
          })
          return "unreached"
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("caught: do not retry")
  })
})

// ---------- Metadata ----------

describe("metadata", () => {
  it("set + increment + append accumulate across the run", async () => {
    const wf = workflow<void, void>({
      id: "meta.basic",
      async run(_, ctx) {
        ctx.metadata.set("phase", "start")
        ctx.metadata.increment("count")
        await ctx.step("work", async () => undefined)
        ctx.metadata.increment("count", 2)
        ctx.metadata.append("trace", "step-1-done")
        ctx.metadata.set("phase", "end")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.metadata).toEqual({
      phase: "end",
      count: 3,
      trace: ["step-1-done"],
    })
  })

  it("is remembered across a sleep-induced replay", async () => {
    const wf = workflow<void, void>({
      id: "meta.replay",
      async run(_, ctx) {
        ctx.metadata.set("before", true)
        ctx.metadata.increment("hits")
        await ctx.sleep("1h")
        ctx.metadata.set("after", true)
        ctx.metadata.increment("hits")
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    // Positional dedup: each mutation is applied exactly once despite
    // the body replaying across the sleep.
    expect(result.metadata.hits).toBe(2)
    expect(result.metadata.before).toBe(true)
    expect(result.metadata.after).toBe(true)
  })
})

// ---------- Deterministic replay ----------

describe("ctx.now", () => {
  it("advances on journaled step completions", async () => {
    let clockCalls: number[] = []

    const wf = workflow<void, number[]>({
      id: "now.advances",
      async run(_, ctx) {
        clockCalls = []
        clockCalls.push(ctx.now())
        await ctx.step("a", () => 1)
        clockCalls.push(ctx.now())
        await ctx.step("b", () => 2)
        clockCalls.push(ctx.now())
        return clockCalls
      },
    })

    const t0 = 1_000_000_000_000
    const clock = (() => {
      let t = t0
      return () => {
        t += 10
        return t
      }
    })()

    const result = await runWorkflowForTest(wf, undefined, { now: clock })

    expect(result.status).toBe("completed")
    const [c0, c1, c2] = result.output!
    // Before any step finished, clock sits at the run-start timestamp.
    expect(c0).toBe(t0 + 10)
    // After step a finished, ctx.now advances to the step's finishedAt.
    expect(c1).toBeGreaterThan(c0!)
    expect(c2).toBeGreaterThan(c1!)
  })
})

// ---------- Parallel steps (Promise.all) ----------

describe("parallel steps", () => {
  it("journals concurrent steps by id", async () => {
    const wf = workflow<void, number>({
      id: "parallel.all",
      async run(_, ctx) {
        const [a, b, c] = await Promise.all([
          ctx.step("a", () => 1),
          ctx.step("b", () => 2),
          ctx.step("c", () => 3),
        ])
        return a + b + c
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe(6)
    expect(result.steps.map((s) => s.id).sort()).toEqual(["a", "b", "c"])
  })
})
