import { describe, expect, it, vi } from "vitest"

import { createSaga, SagaError, sagaStep } from "../../src/saga.js"

describe("sagaStep", () => {
  it("is chainable and stores the step name", () => {
    const builder = sagaStep("reserve-inventory")
      .run(async () => "ok")
      .compensate(async () => {})
    expect(builder.definition.name).toBe("reserve-inventory")
    expect(builder.definition.runFn).toBeDefined()
    expect(builder.definition.compensateFn).toBeDefined()
  })

  it("returns the same builder instance from each chained call", () => {
    const b1 = sagaStep("a")
    const b2 = b1.run(async () => 1)
    const b3 = b2.compensate(async () => {})
    expect(b1).toBe(b2)
    expect(b2).toBe(b3)
  })
})

describe("createSaga", () => {
  it("runs all steps sequentially and collects outputs", async () => {
    const order: string[] = []
    const wf = createSaga("three-step", [
      sagaStep<unknown, number>("one").run(() => {
        order.push("one")
        return 1
      }),
      sagaStep<unknown, number>("two").run(() => {
        order.push("two")
        return 2
      }),
      sagaStep<unknown, number>("three").run(() => {
        order.push("three")
        return 3
      }),
    ])
    const result = await wf.run()
    expect(order).toEqual(["one", "two", "three"])
    expect(result.results).toEqual({ one: 1, two: 2, three: 3 })
  })

  it("passes saga input to each step's run function", async () => {
    const seen: unknown[] = []
    const wf = createSaga("input-passing", [
      sagaStep("a").run((input) => {
        seen.push(input)
        return "a"
      }),
      sagaStep("b").run((input) => {
        seen.push(input)
        return "b"
      }),
    ])
    await wf.run({ input: { tag: "hello" } })
    expect(seen).toEqual([{ tag: "hello" }, { tag: "hello" }])
  })

  it("exposes prior step results via ctx.results", async () => {
    const seen: Record<string, unknown>[] = []
    const wf = createSaga("chained", [
      sagaStep("first").run(() => "alpha"),
      sagaStep("second").run((_input, ctx) => {
        seen.push({ ...ctx.results })
        return "beta"
      }),
      sagaStep("third").run((_input, ctx) => {
        seen.push({ ...ctx.results })
        return "gamma"
      }),
    ])
    await wf.run()
    expect(seen[0]).toEqual({ first: "alpha" })
    expect(seen[1]).toEqual({ first: "alpha", second: "beta" })
  })

  it("exposes saga name on ctx", async () => {
    let observedName = ""
    const wf = createSaga("my-saga", [
      sagaStep("only").run((_input, ctx) => {
        observedName = ctx.sagaName
        return null
      }),
    ])
    await wf.run()
    expect(observedName).toBe("my-saga")
  })

  it("runs compensations in reverse order on failure", async () => {
    const events: string[] = []
    const wf = createSaga("rolls-back", [
      sagaStep("a")
        .run(() => {
          events.push("run:a")
          return "a-out"
        })
        .compensate(() => {
          events.push("comp:a")
        }),
      sagaStep("b")
        .run(() => {
          events.push("run:b")
          return "b-out"
        })
        .compensate(() => {
          events.push("comp:b")
        }),
      sagaStep("c").run(() => {
        events.push("run:c")
        throw new Error("boom")
      }),
    ])
    await expect(wf.run()).rejects.toThrow("boom")
    expect(events).toEqual(["run:a", "run:b", "run:c", "comp:b", "comp:a"])
  })

  it("passes each step's output to its compensation function", async () => {
    const observed: unknown[] = []
    const wf = createSaga("comp-output", [
      sagaStep("a")
        .run(() => ({ id: "pers_1" }))
        .compensate((output) => {
          observed.push(output)
        }),
      sagaStep("b").run(() => {
        throw new Error("fail")
      }),
    ])
    await expect(wf.run()).rejects.toThrow("fail")
    expect(observed).toEqual([{ id: "pers_1" }])
  })

  it("skips steps that have no compensation when rolling back", async () => {
    const events: string[] = []
    const wf = createSaga("partial-comp", [
      sagaStep("a")
        .run(() => "a")
        .compensate(() => {
          events.push("comp:a")
        }),
      sagaStep("b").run(() => "b"),
      sagaStep("c")
        .run(() => "c")
        .compensate(() => {
          events.push("comp:c")
        }),
      sagaStep("d").run(() => {
        throw new Error("nope")
      }),
    ])
    await expect(wf.run()).rejects.toThrow("nope")
    expect(events).toEqual(["comp:c", "comp:a"])
  })

  it("continues compensation even if a compensation function throws", async () => {
    const events: string[] = []
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const wf = createSaga("comp-error", [
      sagaStep("a")
        .run(() => "a")
        .compensate(() => {
          events.push("comp:a")
        }),
      sagaStep("b")
        .run(() => "b")
        .compensate(() => {
          events.push("comp:b")
          throw new Error("comp-failed")
        }),
      sagaStep("c").run(() => {
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
    const wf = createSaga("self-fail", [
      sagaStep("a")
        .run(() => "a")
        .compensate(() => {
          events.push("comp:a")
        }),
      sagaStep("b")
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

  it("throws a SagaError when a step has no run function", async () => {
    const wf = createSaga("no-run", [sagaStep("oops")])
    await expect(wf.run()).rejects.toBeInstanceOf(SagaError)
  })

  it("throws on duplicate step names at creation time", () => {
    expect(() => createSaga("dup", [sagaStep("a").run(() => 1), sagaStep("a").run(() => 2)])).toThrow(
      SagaError,
    )
  })

  it("awaits async run functions", async () => {
    const wf = createSaga("async-runs", [
      sagaStep("slow").run(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return "done"
      }),
    ])
    const result = await wf.run()
    expect(result.results.slow).toBe("done")
  })

  it("re-throws the original error after compensation", async () => {
    const original = new Error("original-fail")
    const wf = createSaga("throws-original", [
      sagaStep("a")
        .run(() => "a")
        .compensate(() => {}),
      sagaStep("b").run(() => {
        throw original
      }),
    ])
    await expect(wf.run()).rejects.toBe(original)
  })
})

describe("createSaga resume", () => {
  it("skips steps before skipUntil and seeds their outputs from seedResults", async () => {
    const ran: string[] = []
    const wf = createSaga("resumeable", [
      sagaStep<unknown, number>("a").run(() => {
        ran.push("a")
        return 1
      }),
      sagaStep<unknown, number>("b").run(() => {
        ran.push("b")
        return 2
      }),
      sagaStep<unknown, number>("c").run((_, ctx) => {
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
    const wf = createSaga("no-compensate-skipped", [
      sagaStep<unknown, string>("a")
        .run(() => "a-out")
        .compensate(() => {
          compensated.push("a")
        }),
      sagaStep<unknown, string>("b")
        .run(() => "b-out")
        .compensate(() => {
          compensated.push("b")
        }),
      sagaStep("c").run(() => {
        throw new Error("boom")
      }),
    ])
    await expect(
      wf.run({ skipUntil: "c", seedResults: { a: "a-out", b: "b-out" } }),
    ).rejects.toThrow("boom")
    expect(compensated).toEqual([])
  })

  it("throws when skipUntil names a step that does not exist", async () => {
    const wf = createSaga("missing-skip-target", [sagaStep("a").run(() => "a")])
    await expect(wf.run({ skipUntil: "z" })).rejects.toThrow(/cannot resume.*"z"/)
  })
})
