import type { EventFilterDescriptor } from "@voyant-travel/core"
import type { WorkflowDefinition } from "@voyant-travel/workflows"
import type { ServiceResolver } from "@voyant-travel/workflows/driver"
import { describe, expect, it, vi } from "vitest"
import { loadVoyantNodeWorkflowRuntime } from "./node-workflow-runtime.js"
import type { VoyantGraphRuntime, VoyantGraphRuntimeUnitLoader } from "./runtime-lowering.js"

describe("loadVoyantNodeWorkflowRuntime", () => {
  it("loads only selected workflows and manifest event filters", async () => {
    const workflow = { id: "notifications.send", run: vi.fn() } as unknown as WorkflowDefinition
    const filter: EventFilterDescriptor = {
      id: "notifications.on-booking-created",
      eventType: "booking.created",
      manifest: {
        id: "notifications.on-booking-created",
        eventType: "booking.created",
        payloadHash: "sha256:payload",
        targetWorkflowId: workflow.id,
      },
    }
    const services = { resolve: vi.fn(), has: vi.fn() } as unknown as ServiceResolver
    const createServices = vi.fn(async () => services)
    const runtime = await loadVoyantNodeWorkflowRuntime({
      graphRuntime: graphWithUnit(unitWithRuntime(workflow, filter)),
      environment: { DATABASE_URL: "postgres://example.invalid/voyant" },
      createServices,
    })

    expect(runtime.workflows).toEqual([workflow])
    expect(runtime.eventFilters).toEqual([filter])
    expect(runtime.workflowResolver.resolve(workflow.id)).toBe(workflow)
    expect(createServices).toHaveBeenCalledWith(
      { DATABASE_URL: "postgres://example.invalid/voyant" },
      new Set(["notifications"]),
    )
  })
})

function unitWithRuntime(
  workflow: WorkflowDefinition,
  filter: EventFilterDescriptor,
): VoyantGraphRuntimeUnitLoader {
  return {
    id: "notifications",
    workflows: [{ load: async () => workflow }],
    references: [
      { facet: "subscribers.runtime", load: async () => filter },
      { facet: "routes.runtime", load: async () => ({}) },
    ],
  } as unknown as VoyantGraphRuntimeUnitLoader
}

function graphWithUnit(unit: VoyantGraphRuntimeUnitLoader): VoyantGraphRuntime {
  return { modules: [unit], extensions: [], plugins: [] } as unknown as VoyantGraphRuntime
}
