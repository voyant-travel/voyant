import { __listRegisteredWorkflows, __resetRegistry } from "@voyant-travel/workflows"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const channelPushWorkflowIds = [
  "channel.availability.push",
  "channel.booking.push",
  "channel.content.push",
] as const

function registeredWorkflowIds(): string[] {
  return __listRegisteredWorkflows().map((workflow) => workflow.id)
}

beforeEach(() => {
  __resetRegistry()
  vi.resetModules()
})

afterEach(() => {
  __resetRegistry()
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe("channel-push workflow registration", () => {
  it("does not self-register workflows from the package root", async () => {
    await import("@voyant-travel/distribution")

    expect(registeredWorkflowIds()).not.toEqual(expect.arrayContaining(channelPushWorkflowIds))
  })

  it("registers channel-push workflows from the explicit workflow subpath", async () => {
    await import("@voyant-travel/distribution/channel-push-workflows")

    const workflows = __listRegisteredWorkflows()
    expect(workflows.map((workflow) => workflow.id)).toEqual(
      expect.arrayContaining(channelPushWorkflowIds),
    )
    expect(
      workflows.find((workflow) => workflow.id === "channel.availability.push")?.config.schedule,
    ).toBeUndefined()
    expect(
      workflows.find((workflow) => workflow.id === "channel.content.push")?.config.schedule,
    ).toBeUndefined()
  })

  it("attaches channel-push schedules when explicitly enabled", async () => {
    vi.stubEnv("VOYANT_DISTRIBUTION_CHANNEL_PUSH_ENABLED", "true")

    await import("@voyant-travel/distribution/channel-push-workflows")

    const workflows = __listRegisteredWorkflows()
    expect(
      workflows.find((workflow) => workflow.id === "channel.availability.push")?.config.schedule,
    ).toEqual({ every: "30s" })
    expect(
      workflows.find((workflow) => workflow.id === "channel.content.push")?.config.schedule,
    ).toEqual({ every: "5m" })
  })

  it("uses the all-channel concurrency key for scheduled null inputs", async () => {
    await import("@voyant-travel/distribution/channel-push-workflows")

    const workflows = __listRegisteredWorkflows()
    const availabilityKey = workflows.find(
      (workflow) => workflow.id === "channel.availability.push",
    )?.config.concurrency?.key
    const contentKey = workflows.find((workflow) => workflow.id === "channel.content.push")?.config
      .concurrency?.key

    expect(typeof availabilityKey).toBe("function")
    expect(typeof contentKey).toBe("function")
    expect((availabilityKey as (input: null) => string)(null)).toBe("all")
    expect((contentKey as (input: null) => string)(null)).toBe("all")
  })

  it("resolves workflow dependencies from the execution service container", async () => {
    const { CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY, channelAvailabilityPushWorkflow } = await import(
      "@voyant-travel/distribution/channel-push-workflows"
    )
    const deps = { db: {}, registry: {} }
    const resolve = vi.fn(() => deps)
    const result = { attempted: 0, succeeded: 0, failed: 0, skipped: 0 }
    const step = vi.fn(async () => result)

    await expect(
      channelAvailabilityPushWorkflow.config.run(null, {
        services: { resolve, has: () => true },
        step,
      } as never),
    ).resolves.toBe(result)
    expect(resolve).toHaveBeenCalledWith(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY)
    expect(step).toHaveBeenCalledWith("process-availability-push", expect.any(Function))
  })
})
