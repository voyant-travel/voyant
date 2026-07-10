import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { defineWorkflow, type WorkflowDefinition, workflow } from "../index.js"
import { __listRegisteredWorkflows, __resetRegistry, getWorkflow } from "../workflow.js"

beforeEach(() => {
  __resetRegistry()
})

describe("defineWorkflow", () => {
  it("constructs a workflow definition without registering it", () => {
    const config = {
      id: "booking.reminder",
      schedule: { cron: "0 8 * * *", timezone: "Europe/Bucharest" },
      retry: { max: 4 as const, backoff: "exponential" as const },
      tags: ["booking"],
      async run(input: { bookingId: string }) {
        return input.bookingId
      },
    }

    const definition = defineWorkflow(config)

    expect(definition).toEqual({ id: config.id, config })
    expect(definition.config).toBe(config)
    expect(definition.config.schedule).toBe(config.schedule)
    expect(definition.config.retry).toBe(config.retry)
    expect(JSON.parse(JSON.stringify(definition))).toEqual({
      id: "booking.reminder",
      config: {
        id: "booking.reminder",
        schedule: { cron: "0 8 * * *", timezone: "Europe/Bucharest" },
        retry: { max: 4, backoff: "exponential" },
        tags: ["booking"],
      },
    })
    expect(getWorkflow(config.id)).toBeUndefined()
    expect(__listRegisteredWorkflows()).toEqual([])
    expectTypeOf(definition).toEqualTypeOf<WorkflowDefinition<{ bookingId: string }, string>>()
  })

  it("supports default exports and explicit collection without registry side effects", async () => {
    const { default: pureWorkflow } = await import("./fixtures/pure-workflow.js")
    const definitions: WorkflowDefinition[] = [pureWorkflow]

    expect(definitions).toEqual([pureWorkflow])
    expect(pureWorkflow.id).toBe("fixture.pure-workflow")
    expect(__listRegisteredWorkflows()).toEqual([])
  })

  it("has the same config typing and inference contract as workflow", () => {
    expectTypeOf(defineWorkflow).toEqualTypeOf(workflow)
  })
})

describe("workflow", () => {
  it("registers a legacy workflow exactly once", () => {
    const definition = workflow({ id: "legacy.once", async run() {} })

    expect(getWorkflow(definition.id)).toBe(definition)
    expect(__listRegisteredWorkflows()).toEqual([definition])
  })

  it("preserves duplicate replacement and warning behavior", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const first = workflow({ id: "legacy.duplicate", async run() {} })
    const replacement = workflow({ id: "legacy.duplicate", async run() {} })

    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      '[workflows] workflow id "legacy.duplicate" re-registered — assuming HMR re-import. If this is a real duplicate, `voyant workflows build` will reject the bundle.',
    )
    expect(__listRegisteredWorkflows()).toEqual([replacement])
    expect(getWorkflow(first.id)).toBe(replacement)

    warn.mockRestore()
  })
})
