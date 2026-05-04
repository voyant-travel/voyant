import { describe, expect, it, vi } from "vitest"

import type { JobRunner } from "../../src/orchestration.js"
import { createWorkflow, step, WorkflowError } from "../../src/workflows.js"

describe("step", () => {
  it("is chainable and stores the step name", () => {
    const builder = step("reserve-inventory")
      .run(async () => "ok")
      .compensate(async () => {})
    expect(builder.definition.name).toBe("reserve-inventory")
    expect(builder.definition.runFn).toBeDefined()
    expect(builder.definition.compensateFn).toBeDefined()
    expect(builder.definition.isAsync).toBe(false)
  })

  it("returns the same builder instance from each chained call", () => {
    const b1 = step("a")
    const b2 = b1.run(async () => 1)
    const b3 = b2.compensate(async () => {})
    const b4 = b3.async()
    expect(b1).toBe(b2)
    expect(b2).toBe(b3)
    expect(b3).toBe(b4)
  })

  it("marks a step as async with optional job options", () => {
    const builder = step("notify").async({ maxAttempts: 3, delayMs: 100 })
    expect(builder.definition.isAsync).toBe(true)
    expect(builder.definition.jobOptions).toEqual({ maxAttempts: 3, delayMs: 100 })
  })
})

describe("createWorkflow", () => {
  it("runs all steps sequentially and collects outputs", async () => {
    const order: string[] = []
    const wf = createWorkflow("three-step", [
      step<unknown, number>("one").run(() => {
        order.push("one")
        return 1
      }),
      step<unknown, number>("two").run(() => {
        order.push("two")
        return 2
      }),
      step<unknown, number>("three").run(() => {
        order.push("three")
        return 3
      }),
    ])
    const result = await wf.run()
    expect(order).toEqual(["one", "two", "three"])
    expect(result.results).toEqual({ one: 1, two: 2, three: 3 })
  })

  it("passes workflow input to each step's run function", async () => {
    const seen: unknown[] = []
    const wf = createWorkflow("input-passing", [
      step("a").run((input) => {
        seen.push(input)
        return "a"
      }),
      step("b").run((input) => {
        seen.push(input)
        return "b"
      }),
    ])
    await wf.run({ input: { tag: "hello" } })
    expect(seen).toEqual([{ tag: "hello" }, { tag: "hello" }])
  })

  it("exposes prior step results via ctx.results", async () => {
    const seen: Record<string, unknown>[] = []
    const wf = createWorkflow("chained", [
      step("first").run(() => "alpha"),
      step("second").run((_input, ctx) => {
        seen.push({ ...ctx.results })
        return "beta"
      }),
      step("third").run((_input, ctx) => {
        seen.push({ ...ctx.results })
        return "gamma"
      }),
    ])
    await wf.run()
    expect(seen[0]).toEqual({ first: "alpha" })
    expect(seen[1]).toEqual({ first: "alpha", second: "beta" })
  })

  it("exposes workflow name on ctx", async () => {
    let observedName = ""
    const wf = createWorkflow("my-workflow", [
      step("only").run((_input, ctx) => {
        observedName = ctx.workflowName
        return null
      }),
    ])
    await wf.run()
    expect(observedName).toBe("my-workflow")
  })

  it("runs compensations in reverse order on failure", async () => {
    const events: string[] = []
    const wf = createWorkflow("rolls-back", [
      step("a")
        .run(() => {
          events.push("run:a")
          return "a-out"
        })
        .compensate(() => {
          events.push("comp:a")
        }),
      step("b")
        .run(() => {
          events.push("run:b")
          return "b-out"
        })
        .compensate(() => {
          events.push("comp:b")
        }),
      step("c").run(() => {
        events.push("run:c")
        throw new Error("boom")
      }),
    ])
    await expect(wf.run()).rejects.toThrow("boom")
    expect(events).toEqual(["run:a", "run:b", "run:c", "comp:b", "comp:a"])
  })

  it("passes each step's output to its compensation function", async () => {
    const observed: unknown[] = []
    const wf = createWorkflow("comp-output", [
      step("a")
        .run(() => ({ id: "pers_1" }))
        .compensate((output) => {
          observed.push(output)
        }),
      step("b").run(() => {
        throw new Error("fail")
      }),
    ])
    await expect(wf.run()).rejects.toThrow("fail")
    expect(observed).toEqual([{ id: "pers_1" }])
  })

  it("skips steps that have no compensation when rolling back", async () => {
    const events: string[] = []
    const wf = createWorkflow("partial-comp", [
      step("a")
        .run(() => "a")
        .compensate(() => {
          events.push("comp:a")
        }),
      step("b").run(() => "b"),
      step("c")
        .run(() => "c")
        .compensate(() => {
          events.push("comp:c")
        }),
      step("d").run(() => {
        throw new Error("nope")
      }),
    ])
    await expect(wf.run()).rejects.toThrow("nope")
    expect(events).toEqual(["comp:c", "comp:a"])
  })

  it("continues compensation even if a compensation function throws", async () => {
    const events: string[] = []
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const wf = createWorkflow("comp-error", [
      step("a")
        .run(() => "a")
        .compensate(() => {
          events.push("comp:a")
        }),
      step("b")
        .run(() => "b")
        .compensate(() => {
          events.push("comp:b")
          throw new Error("comp-failed")
        }),
      step("c").run(() => {
        throw new Error("main-failed")
      }),
    ])
    await expect(wf.run()).rejects.toThrow("main-failed")
    expect(events).toEqual(["comp:b", "comp:a"])
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("does not run compensation for a step that itself failed", async () => {
    const events: string[] = []
    const wf = createWorkflow("self-fail", [
      step("a")
        .run(() => "a")
        .compensate(() => {
          events.push("comp:a")
        }),
      step("b")
        .run(() => {
          throw new Error("fail-b")
        })
        .compensate(() => {
          events.push("comp:b")
        }),
    ])
    await expect(wf.run()).rejects.toThrow("fail-b")
    expect(events).toEqual(["comp:a"])
  })

  it("enqueues async steps via the injected JobRunner", async () => {
    const enqueue = vi.fn<JobRunner["enqueue"]>(async () => "job_123")
    const jobRunner: JobRunner = {
      enqueue,
      schedule: async () => {},
    }
    const wf = createWorkflow("with-async", [
      step("prepare").run(() => ({ count: 2 })),
      step("notify").async({ maxAttempts: 3 }),
    ])
    const result = await wf.run({ input: { userId: "u1" }, jobRunner })
    expect(enqueue).toHaveBeenCalledOnce()
    expect(enqueue).toHaveBeenCalledWith("notify", { userId: "u1" }, { maxAttempts: 3 })
    expect(result.results.notify).toEqual({ jobId: "job_123" })
  })

  it("throws a WorkflowError when an async step is reached without a jobRunner", async () => {
    const wf = createWorkflow("needs-runner", [step("notify").async()])
    await expect(wf.run()).rejects.toBeInstanceOf(WorkflowError)
  })

  it("throws a WorkflowError when a non-async step has no run function", async () => {
    const wf = createWorkflow("no-run", [step("oops")])
    await expect(wf.run()).rejects.toBeInstanceOf(WorkflowError)
  })

  it("does not compensate async steps on failure", async () => {
    const events: string[] = []
    const jobRunner: JobRunner = {
      enqueue: async () => "job_1",
      schedule: async () => {},
    }
    const wf = createWorkflow("async-no-comp", [
      step("a")
        .run(() => "a")
        .compensate(() => {
          events.push("comp:a")
        }),
      step("b").async(),
      step("c").run(() => {
        throw new Error("fail")
      }),
    ])
    await expect(wf.run({ jobRunner })).rejects.toThrow("fail")
    expect(events).toEqual(["comp:a"])
  })

  it("throws on duplicate step names at creation time", () => {
    expect(() => createWorkflow("dup", [step("a").run(() => 1), step("a").run(() => 2)])).toThrow(
      WorkflowError,
    )
  })

  it("awaits async run functions", async () => {
    const wf = createWorkflow("async-runs", [
      step("slow").run(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return "done"
      }),
    ])
    const result = await wf.run()
    expect(result.results.slow).toBe("done")
  })

  it("re-throws the original error after compensation", async () => {
    const original = new Error("original-fail")
    const wf = createWorkflow("throws-original", [
      step("a")
        .run(() => "a")
        .compensate(() => {}),
      step("b").run(() => {
        throw original
      }),
    ])
    await expect(wf.run()).rejects.toBe(original)
  })
})

describe("createWorkflow resume", () => {
  it("skips steps before skipUntil and seeds their outputs from seedResults", async () => {
    const ran: string[] = []
    const wf = createWorkflow("resumeable", [
      step<unknown, number>("a").run(() => {
        ran.push("a")
        return 1
      }),
      step<unknown, number>("b").run(() => {
        ran.push("b")
        return 2
      }),
      step<unknown, number>("c").run((_, ctx) => {
        ran.push("c")
        return (ctx.results.a as number) + (ctx.results.b as number)
      }),
    ])
    const result = await wf.run({
      skipUntil: "c",
      seedResults: { a: 1, b: 2 },
    })
    expect(ran).toEqual(["c"])
    expect(result.results).toEqual({ a: 1, b: 2, c: 3 })
  })

  it("does not run compensation for skipped steps when a later step fails", async () => {
    const compensated: string[] = []
    const wf = createWorkflow("no-compensate-skipped", [
      step<unknown, string>("a")
        .run(() => "a-out")
        .compensate(() => {
          compensated.push("a")
        }),
      step<unknown, string>("b")
        .run(() => "b-out")
        .compensate(() => {
          compensated.push("b")
        }),
      step("c").run(() => {
        throw new Error("boom")
      }),
    ])
    await expect(
      wf.run({ skipUntil: "c", seedResults: { a: "a-out", b: "b-out" } }),
    ).rejects.toThrow("boom")
    expect(compensated).toEqual([])
  })

  it("throws when skipUntil names a step that does not exist", async () => {
    const wf = createWorkflow("missing-skip-target", [step("a").run(() => "a")])
    await expect(wf.run({ skipUntil: "z" })).rejects.toThrow(/cannot resume.*"z"/)
  })
})
