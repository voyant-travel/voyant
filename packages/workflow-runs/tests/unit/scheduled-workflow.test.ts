import type { WorkflowDriver } from "@voyant-travel/workflows/driver"
import { describe, expect, it, vi } from "vitest"

import { isGraphWorkflowScheduledJob, runScheduledWorkflow } from "../../src/scheduled-workflow.js"

describe("scheduled workflow dispatch", () => {
  it("registers the selected manifest and triggers with a stable idempotency key", async () => {
    const registerManifest = vi.fn(async () => ({ versionId: "version_1" }))
    const trigger = vi.fn(async () => ({
      id: "run_1",
      workflowId: "notifications.send",
      status: "queued" as const,
      startedAt: 1,
    }))
    const driver = {
      registerManifest,
      trigger,
      ingestEvent: vi.fn(),
      getManifest: vi.fn(),
    } satisfies WorkflowDriver
    const workflow = {
      id: "notifications.send",
      config: { id: "notifications.send", async run() {} },
    }

    await runScheduledWorkflow(
      { id: "notifications-hourly", workflowId: workflow.id, input: { limit: 25 } },
      { scheduledTime: 1_783_661_445_000 },
      {
        projectId: "operator",
        environment: "production",
        load: async () => ({
          workflows: [workflow],
          eventFilters: [],
          services: { resolve: vi.fn(), has: vi.fn(() => false) },
        }),
        createDriver: () => driver,
      },
    )

    expect(registerManifest).toHaveBeenCalledWith({
      environment: "production",
      manifest: expect.objectContaining({ projectId: "operator" }),
    })
    expect(trigger).toHaveBeenCalledWith(
      "notifications.send",
      { limit: 25 },
      {
        environment: "production",
        idempotencyKey: "scheduled:notifications-hourly:1783661445000",
        tags: ["scheduled", "schedule:notifications-hourly"],
      },
    )
  })

  it("recognizes only jobs carrying a workflow id", () => {
    expect(isGraphWorkflowScheduledJob({ workflowId: "workflow.hourly" })).toBe(true)
    expect(isGraphWorkflowScheduledJob({})).toBe(false)
  })
})
