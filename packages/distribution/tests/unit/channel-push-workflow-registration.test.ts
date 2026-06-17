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
})
