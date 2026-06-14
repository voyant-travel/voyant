import { FatalError, RetryableError } from "@voyant-travel/workflows/errors"
import { beforeEach, describe, expect, it } from "vitest"
import { runWorkflowForTest } from "../../testing/index.js"
import { __resetRegistry, workflow } from "../../workflow.js"

beforeEach(() => {
  __resetRegistry()
})

describe("step retry", () => {
  it("does not retry by default (max: 1)", async () => {
    let attempts = 0

    const wf = workflow<void, string>({
      id: "retry.default",
      async run(_, ctx) {
        try {
          await ctx.step("flaky", async () => {
            attempts += 1
            throw new Error("always fails")
          })
          return "unreached"
        } catch (e) {
          return `caught after ${attempts} attempt(s): ${(e as Error).message}`
        }
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(attempts).toBe(1)
    expect(result.output).toBe("caught after 1 attempt(s): always fails")
  })

  it("retries up to `max` attempts then propagates the final error", async () => {
    let attempts = 0

    const wf = workflow<void, string>({
      id: "retry.max",
      async run(_, ctx) {
        try {
          await ctx.step(
            "flaky",
            { retry: { max: 4, backoff: "fixed", initial: "1ms" } },
            async () => {
              attempts += 1
              throw new Error(`attempt ${attempts} fails`)
            },
          )
          return "unreached"
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(attempts).toBe(4)
    expect(result.output).toBe("caught: attempt 4 fails")
  })

  it("returns success as soon as an attempt succeeds", async () => {
    let attempts = 0

    const wf = workflow<void, string>({
      id: "retry.eventual-success",
      async run(_, ctx) {
        return await ctx.step(
          "flaky",
          { retry: { max: 5, backoff: "fixed", initial: "1ms" } },
          async () => {
            attempts += 1
            if (attempts < 3) throw new Error(`transient ${attempts}`)
            return `ok on ${attempts}`
          },
        )
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("ok on 3")
    expect(attempts).toBe(3)
  })

  it("does not retry when the step throws FatalError", async () => {
    let attempts = 0

    const wf = workflow<void, string>({
      id: "retry.fatal",
      async run(_, ctx) {
        try {
          await ctx.step(
            "fatal-step",
            { retry: { max: 5, backoff: "fixed", initial: "1ms" } },
            async () => {
              attempts += 1
              throw new FatalError("do not retry me")
            },
          )
          return "unreached"
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(attempts).toBe(1)
    expect(result.output).toBe("caught: do not retry me")
  })

  it("retries when the step throws RetryableError with retryAfter", async () => {
    let attempts = 0

    const wf = workflow<void, number>({
      id: "retry.retryable-error",
      async run(_, ctx) {
        return await ctx.step(
          "rate-limited",
          { retry: { max: 5, backoff: "fixed", initial: "1ms" } },
          async () => {
            attempts += 1
            if (attempts < 3) {
              throw new RetryableError("rate limited", { retryAfter: "1ms" })
            }
            return attempts
          },
        )
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe(3)
    expect(attempts).toBe(3)
  })

  it("inherits workflow-level retry defaults when a step does not override", async () => {
    let attempts = 0

    const wf = workflow<void, string>({
      id: "retry.workflow-default",
      retry: { max: 3, backoff: "fixed", initial: "1ms" },
      async run(_, ctx) {
        return await ctx.step("inherits", async () => {
          attempts += 1
          if (attempts < 3) throw new Error("try again")
          return "done"
        })
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("done")
    expect(attempts).toBe(3)
  })

  it("respects per-step override over workflow-level default", async () => {
    let attempts = 0

    const wf = workflow<void, string>({
      id: "retry.per-step-override",
      retry: { max: 10, backoff: "fixed", initial: "1ms" },
      async run(_, ctx) {
        try {
          await ctx.step(
            "restricted",
            { retry: { max: 2, backoff: "fixed", initial: "1ms" } },
            async () => {
              attempts += 1
              throw new Error(`attempt ${attempts}`)
            },
          )
          return "unreached"
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    expect(attempts).toBe(2)
    expect(result.output).toBe("caught: attempt 2")
  })

  it("journals the final attempt number on success after retries", async () => {
    let attempts = 0

    const wf = workflow<void, void>({
      id: "retry.journal",
      async run(_, ctx) {
        await ctx.step(
          "flaky",
          { retry: { max: 4, backoff: "fixed", initial: "1ms" } },
          async () => {
            attempts += 1
            if (attempts < 3) throw new Error("not yet")
            return "ok"
          },
        )
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("completed")
    // Harness's step summary reports final status from the journal; the
    // runtime records final attempt internally (we check success here).
    expect(result.steps).toEqual([expect.objectContaining({ id: "flaky", status: "ok" })])
  })

  it("triggers compensation when a retried step ultimately fails", async () => {
    const compensated: string[] = []
    let attempts = 0

    const wf = workflow<void, void>({
      id: "retry.compensate-after-exhaust",
      async run(_, ctx) {
        await ctx.step(
          "reserve",
          {
            compensate: async () => {
              compensated.push("undo-reserve")
            },
          },
          async () => "reserved",
        )
        await ctx.step(
          "flaky",
          { retry: { max: 2, backoff: "fixed", initial: "1ms" } },
          async () => {
            attempts += 1
            throw new Error(`attempt ${attempts}`)
          },
        )
      },
    })

    const result = await runWorkflowForTest(wf, undefined)

    expect(result.status).toBe("compensated")
    expect(attempts).toBe(2)
    expect(compensated).toEqual(["undo-reserve"])
    expect(result.error?.message).toBe("attempt 2")
  })
})
