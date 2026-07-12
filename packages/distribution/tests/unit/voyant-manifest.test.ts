import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"
import { channelPushRuntimePort } from "../../src/channel-push/runtime-port.js"
import {
  channelAvailabilityPushWorkflow,
  channelBookingPushWorkflow,
  channelContentPushWorkflow,
  channelPushAvailabilityReconcileWorkflow,
  channelPushBookingLinkReconcileWorkflow,
  channelPushContentReconcileWorkflow,
} from "../../src/channel-push/workflow-entry.js"
import {
  createChannelPushExtension,
  createChannelPushVoyantRuntime,
  distributionBookingExtension,
  distributionHonoModule,
  externalRefsHonoModule,
  suppliersHonoModule,
} from "../../src/index.js"
import {
  distributionBookingVoyantPlugin,
  distributionChannelPushVoyantPlugin,
  distributionVoyantModule,
} from "../../src/voyant.js"

describe("distribution deployment manifests", () => {
  it("owns the module runtime and persistence facets", () => {
    expect(distributionVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/distribution",
      packageName: "@voyant-travel/distribution",
      api: [
        {
          id: "@voyant-travel/distribution#api.external-refs",
          surface: "admin",
          mount: "external-refs",
          runtime: {
            entry: "@voyant-travel/distribution",
            export: "externalRefsHonoModule",
          },
        },
        {
          id: "@voyant-travel/distribution#api",
          surface: "admin",
          mount: "distribution",
          runtime: {
            entry: "@voyant-travel/distribution",
            export: "distributionHonoModule",
          },
        },
        {
          id: "@voyant-travel/distribution#api.suppliers",
          surface: "admin",
          mount: "suppliers",
          runtime: {
            entry: "@voyant-travel/distribution",
            export: "suppliersHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/distribution#schema" }],
      migrations: [{ id: "@voyant-travel/distribution#migrations" }],
      links: [{ id: "@voyant-travel/distribution#linkable.supplier" }],
    })
  })

  it("owns the booking and channel-push extensions", () => {
    expect(distributionBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/distribution#extension",
      localId: "distribution",
      api: [
        {
          id: "@voyant-travel/distribution#extension.api",
          surface: "admin",
          mount: "bookings",
          runtime: {
            entry: "@voyant-travel/distribution",
            export: "distributionBookingExtension",
          },
        },
      ],
    })

    expect(distributionChannelPushVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/distribution#channel-push-extension",
      localId: "distribution.channel-push-extension",
      runtimePorts: [{ id: "distribution.channel-push-runtime" }],
      api: [
        {
          id: "@voyant-travel/distribution#channel-push-extension.api",
          surface: "admin",
          mount: "distribution",
          runtime: {
            entry: "@voyant-travel/distribution",
            export: "createChannelPushVoyantRuntime",
          },
        },
      ],
    })
  })

  it("references exported runtimes with matching mounts", () => {
    expect(externalRefsHonoModule.module.name).toBe("external-refs")
    expect(distributionHonoModule.module.name).toBe("distribution")
    expect(suppliersHonoModule.module.name).toBe("suppliers")
    expect(distributionBookingExtension.extension.module).toBe("bookings")
    expect(createChannelPushExtension).toBeTypeOf("function")
    expect(createChannelPushVoyantRuntime).toBeTypeOf("function")
  })

  it("owns typed channel-push route and workflow-service composition", async () => {
    const registerWorkflowService = vi.fn()
    const provider = {
      resolveRegistry: vi.fn(() => ({ resolveByConnection: vi.fn() })),
      registerWorkflowService,
    }

    await expect(assertPortConforms(channelPushRuntimePort, provider)).resolves.toBeUndefined()
    await expect(assertPortConforms(channelPushRuntimePort, {} as never)).rejects.toThrow(
      /resolveRegistry/,
    )

    const extension = await createChannelPushVoyantRuntime({
      unitId: distributionChannelPushVoyantPlugin.id,
      projectConfig: {},
      api: distributionChannelPushVoyantPlugin.api ?? [],
      hasPort: () => true,
      getPort: vi.fn(async () => provider) as never,
    })
    const context = {
      bindings: { DATABASE_URL: "postgres://test" },
      container: createContainer(),
      eventBus: createEventBus(),
    }

    expect(extension.extension).toMatchObject({ name: "channel-push", module: "distribution" })
    expect(extension.adminRoutes).toBeDefined()
    await extension.extension.bootstrap?.(context)
    expect(registerWorkflowService).toHaveBeenCalledOnce()
    expect(registerWorkflowService).toHaveBeenCalledWith(context)
  })

  it("references each package-owned workflow definition", () => {
    expect(distributionChannelPushVoyantPlugin.workflows).toEqual([
      expect.objectContaining({
        id: channelBookingPushWorkflow.id,
        runtime: {
          entry: "@voyant-travel/distribution/channel-push-workflows",
          export: "channelBookingPushWorkflow",
        },
      }),
      expect.objectContaining({
        id: channelAvailabilityPushWorkflow.id,
        runtime: {
          entry: "@voyant-travel/distribution/channel-push-workflows",
          export: "channelAvailabilityPushWorkflow",
        },
      }),
      expect.objectContaining({
        id: channelContentPushWorkflow.id,
        runtime: {
          entry: "@voyant-travel/distribution/channel-push-workflows",
          export: "channelContentPushWorkflow",
        },
      }),
      expect.objectContaining({
        id: channelPushBookingLinkReconcileWorkflow.id,
        schedules: [expect.objectContaining({ id: "channel-push-booking-link" })],
      }),
      expect.objectContaining({
        id: channelPushAvailabilityReconcileWorkflow.id,
        schedules: [expect.objectContaining({ id: "channel-push-availability" })],
      }),
      expect.objectContaining({
        id: channelPushContentReconcileWorkflow.id,
        schedules: [expect.objectContaining({ id: "channel-push-content" })],
      }),
    ])
  })

  it("owns executable channel-push subscriber runtime references", () => {
    expect(distributionChannelPushVoyantPlugin.subscribers).toEqual([
      expect.objectContaining({
        id: "@voyant-travel/distribution#subscriber.channel-push-booking-confirmed",
        eventType: "booking.confirmed",
        runtime: {
          entry: "./channel-push-subscribers",
          export: "channelPushBookingConfirmedSubscriber",
        },
      }),
      expect.objectContaining({
        id: "@voyant-travel/distribution#subscriber.channel-push-availability-changed",
        eventType: "availability.slot.changed",
        runtime: {
          entry: "./channel-push-subscribers",
          export: "channelPushAvailabilityChangedSubscriber",
        },
      }),
      expect.objectContaining({
        id: "@voyant-travel/distribution#subscriber.channel-push-content-changed",
        eventType: "product.content.changed",
        runtime: {
          entry: "./channel-push-subscribers",
          export: "channelPushContentChangedSubscriber",
        },
      }),
    ])
  })
})
