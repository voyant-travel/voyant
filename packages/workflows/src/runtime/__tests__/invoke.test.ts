import { beforeEach, describe, expect, it } from "vitest"
import { runWorkflowForTest } from "../../testing/index.js"
import { __resetRegistry, type WorkflowHandle, workflow } from "../../workflow.js"

function unregisteredWorkflow(id: string): WorkflowHandle<unknown, unknown> {
  return { id }
}

beforeEach(() => {
  __resetRegistry()
})

describe("ctx.invoke — child workflows", () => {
  it("returns the child's output to the parent", async () => {
    const addTwo = workflow<{ n: number }, number>({
      id: "child.add-two",
      async run(input, ctx) {
        return await ctx.step("add", () => Promise.resolve(input.n + 2))
      },
    })

    const parent = workflow<{ n: number }, number>({
      id: "parent.simple",
      async run(input, ctx) {
        const result = await ctx.invoke(addTwo, { n: input.n })
        return result * 10
      },
    })

    const result = await runWorkflowForTest(parent, { n: 5 })

    expect(result.status).toBe("completed")
    expect(result.output).toBe(70) // (5 + 2) * 10
    expect(result.invocations).toBe(2)
  })

  it("runs the child before the parent's subsequent steps", async () => {
    const fetchName = workflow<{ id: string }, { name: string }>({
      id: "child.fetch-name",
      async run(input, ctx) {
        return await ctx.step("fetch", () => Promise.resolve({ name: `name-of-${input.id}` }))
      },
    })

    const parent = workflow<{ customerId: string }, string>({
      id: "parent.chains",
      async run(input, ctx) {
        const name = await ctx.invoke(fetchName, { id: input.customerId })
        const greeting = await ctx.step("greet", () => Promise.resolve(`hello ${name.name}`))
        return greeting
      },
    })

    const result = await runWorkflowForTest(parent, { customerId: "c1" })

    expect(result.status).toBe("completed")
    expect(result.output).toBe("hello name-of-c1")
    // Parent's "greet" step ran after the child finished.
    expect(result.steps.map((s) => s.id)).toContain("greet")
  })

  it("propagates the child's failure as a catchable error in the parent", async () => {
    const dies = workflow<void, never>({
      id: "child.dies",
      async run(): Promise<never> {
        throw new Error("child blew up")
      },
    })

    const parent = workflow<void, string>({
      id: "parent.catches",
      async run(_, ctx) {
        try {
          await ctx.invoke(dies, undefined)
          return "no-throw"
        } catch (e) {
          return `caught: ${(e as Error).message}`
        }
      },
    })

    const result = await runWorkflowForTest(parent, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("caught: child blew up")
  })

  it("supports multiple invokes in the same body with unique waitpoint ids", async () => {
    const square = workflow<{ n: number }, number>({
      id: "child.square",
      async run(input, ctx) {
        return await ctx.step("sq", () => Promise.resolve(input.n * input.n))
      },
    })

    const parent = workflow<void, number>({
      id: "parent.multi",
      async run(_, ctx) {
        const a = await ctx.invoke(square, { n: 3 })
        const b = await ctx.invoke(square, { n: 4 })
        const c = await ctx.invoke(square, { n: 5 })
        return a + b + c
      },
    })

    const result = await runWorkflowForTest(parent, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe(9 + 16 + 25)
  })

  it("replays correctly after a sleep that precedes an invoke", async () => {
    const echo = workflow<string, string>({
      id: "child.echo",
      async run(input, ctx) {
        return await ctx.step("echo", () => Promise.resolve(`echoed:${input}`))
      },
    })

    const parent = workflow<void, string>({
      id: "parent.sleep-then-invoke",
      async run(_, ctx) {
        await ctx.step("before", () => Promise.resolve("pre"))
        await ctx.sleep("1h")
        const r = await ctx.invoke(echo, "payload")
        return r
      },
    })

    const result = await runWorkflowForTest(parent, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("echoed:payload")
    // First invocation runs "before" and yields for sleep; second resolves
    // the sleep, registers the RUN waitpoint, yields; third reads the
    // child's result from the journal and finishes.
    expect(result.invocations).toBe(3)
  })

  it("accepts test-level `invoke` fixtures in place of running the child", async () => {
    const stubbedChild = workflow<{ x: number }, { y: number }>({
      id: "child.stubbed",
      async run() {
        throw new Error("should not run — stubbed in TestOptions")
      },
    })

    const parent = workflow<void, number>({
      id: "parent.stubbed",
      async run(_, ctx) {
        const r = await ctx.invoke(stubbedChild, { x: 10 })
        return r.y * 2
      },
    })

    const result = await runWorkflowForTest(parent, undefined, {
      invoke: {
        "child.stubbed": (input: unknown) => ({ y: (input as { x: number }).x + 1 }),
      },
    })

    expect(result.status).toBe("completed")
    expect(result.output).toBe(22) // (10 + 1) * 2
  })

  it("lets detached child runs continue without blocking the parent", async () => {
    const child = workflow<void, string>({
      id: "child.detached-waiting",
      async run(_input, ctx) {
        const approval = await ctx.waitForEvent<{ ok: boolean }>("approve")
        return approval?.ok ? "approved" : "rejected"
      },
    })

    const parent = workflow<void, string>({
      id: "parent.detached-continues",
      async run(_, ctx) {
        await ctx.invoke(child, undefined, { detach: true })
        return "continued"
      },
    })

    const result = await runWorkflowForTest(parent, undefined)

    expect(result.status).toBe("completed")
    expect(result.output).toBe("continued")
  })

  it("triggers parent compensation when a child's failure propagates out", async () => {
    const compensated: string[] = []

    const dies = workflow<void, never>({
      id: "child.dies-again",
      async run(): Promise<never> {
        throw new Error("subroutine down")
      },
    })

    const parent = workflow<void, void>({
      id: "parent.compensates",
      async run(_, ctx) {
        await ctx.step(
          "reserve",
          {
            compensate: async () => {
              compensated.push("release-reservation")
            },
          },
          async () => "reserved",
        )
        await ctx.invoke(dies, undefined)
      },
    })

    const result = await runWorkflowForTest(parent, undefined)

    expect(result.status).toBe("compensated")
    expect(compensated).toEqual(["release-reservation"])
    expect(result.error?.message).toBe("subroutine down")
  })

  it("errors clearly when a child workflow is not registered and no stub is provided", async () => {
    const unregistered = unregisteredWorkflow("never.registered")

    const parent = workflow<void, void>({
      id: "parent.missing-child",
      async run(_, ctx) {
        await ctx.invoke(unregistered, undefined)
      },
    })

    await expect(runWorkflowForTest(parent, undefined)).rejects.toThrow(/not registered/i)
  })
})
