import {
  createContainer,
  createEventBus,
  type EventFilterDescriptor,
  VOYANT_WORKFLOW_SERVICE_CONTRIBUTIONS_PORT_ID,
} from "@voyant-travel/core"
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

  it("registers only graph-selected package workflow service contributions", async () => {
    const services = createContainer()
    const contribution = {
      serviceId: "example.workflow.runtime",
      create: vi.fn(({ environment }) => ({ environment })),
    }
    const runtime = await loadVoyantNodeWorkflowRuntime({
      graphRuntime: graphWithUnit(unitWithRuntime({ id: "example" } as never)),
      environment: { TOKEN: "selected" },
      runtimePorts: {
        [VOYANT_WORKFLOW_SERVICE_CONTRIBUTIONS_PORT_ID]: [contribution],
      },
      createServices: async () => ({ services, eventBus: createEventBus() }),
    })

    expect(runtime.services.resolve("example.workflow.runtime")).toEqual({
      environment: { TOKEN: "selected" },
    })
    expect(contribution.create).toHaveBeenCalledOnce()
  })

  it("reuses graph services when scheduled loads share a container", async () => {
    const services = createContainer()
    const serviceHost = { services, eventBus: createEventBus() }
    const contribution = {
      serviceId: "example.workflow.runtime",
      create: vi.fn(() => ({ selected: true })),
    }
    const options = {
      graphRuntime: graphWithUnit(unitWithRuntime({ id: "example" } as never)),
      environment: {},
      runtimePorts: {
        [VOYANT_WORKFLOW_SERVICE_CONTRIBUTIONS_PORT_ID]: [contribution],
      },
      createServices: async () => serviceHost,
    }

    await loadVoyantNodeWorkflowRuntime(options)
    await loadVoyantNodeWorkflowRuntime(options)

    expect(contribution.create).toHaveBeenCalledOnce()
    expect(services.resolve("example.workflow.runtime")).toEqual({ selected: true })
  })

  it("rejects duplicate workflow services within one contribution batch", async () => {
    const contribution = (selected: string) => ({
      serviceId: "example.workflow.runtime",
      create: vi.fn(() => ({ selected })),
    })

    await expect(
      loadVoyantNodeWorkflowRuntime({
        graphRuntime: graphWithUnit(unitWithRuntime({ id: "example" } as never)),
        environment: {},
        runtimePorts: {
          [VOYANT_WORKFLOW_SERVICE_CONTRIBUTIONS_PORT_ID]: [
            contribution("first"),
            contribution("second"),
          ],
        },
        createServices: async () => ({ services: createContainer(), eventBus: createEventBus() }),
      }),
    ).rejects.toThrow('Workflow service "example.workflow.runtime" is registered more than once.')
  })
})

function unitWithRuntime(
  workflow: WorkflowDefinition,
  filter?: EventFilterDescriptor,
): VoyantGraphRuntimeUnitLoader {
  return {
    id: "notifications",
    workflows: [{ load: async () => workflow }],
    references: [
      ...(filter ? [{ facet: "subscribers.runtime", load: async () => filter }] : []),
      { facet: "routes.runtime", load: async () => ({}) },
    ],
  } as unknown as VoyantGraphRuntimeUnitLoader
}

function graphWithUnit(unit: VoyantGraphRuntimeUnitLoader): VoyantGraphRuntime {
  return { modules: [unit], extensions: [], plugins: [] } as unknown as VoyantGraphRuntime
}
