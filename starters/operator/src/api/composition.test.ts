import { createContainer, createEventBus } from "@voyant-travel/core"
import {
  CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY,
  channelPushRuntimePort,
} from "@voyant-travel/distribution"
import { BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/finance/booking-schedule-subscriber"
import { composeVoyantGraphRuntime } from "@voyant-travel/framework"
import { realtimeRuntimePort } from "@voyant-travel/realtime"
import { storageMediaRuntimePort } from "@voyant-travel/storage/routes"
import { TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/trips/payment-subscribers"
import { describe, expect, it, vi } from "vitest"

import {
  createGeneratedGraphRuntime,
  GENERATED_GRAPH_RUNTIME_EXTENSION_IDS,
  GENERATED_GRAPH_RUNTIME_MODULE_IDS,
  GENERATED_GRAPH_RUNTIME_PLUGIN_IDS,
} from "../../.voyant/runtime/graph-runtime.generated"
import {
  buildOperatorProviders,
  buildOperatorRuntimePorts,
  deploymentLocalExtensions,
  operatorGraphCompatibilityExtensions,
  operatorGraphCompatibilityModules,
  operatorGraphRuntimeBindings,
} from "./composition"
import { recordPaidBookingCancellationSettlement } from "./subscribers/booking-cancellation-settlement"
import { closeTerminalBookingPaymentSchedules } from "./subscribers/booking-payment-cleanup"

async function composeOperatorGraph(runtime = createGeneratedGraphRuntime()) {
  return composeVoyantGraphRuntime({
    runtime,
    capabilities: buildOperatorProviders(),
    bindings: operatorGraphRuntimeBindings,
    ports: buildOperatorRuntimePorts(),
  })
}

describe("operator graph runtime composition", () => {
  it("wires booking payment cleanup and paid-cancellation settlement providers", () => {
    const providers = buildOperatorProviders()

    expect(providers.closePaymentSchedulesForBooking).toBe(closeTerminalBookingPaymentSchedules)
    expect(providers.recordCancellationFinancialSettlement).toBe(
      recordPaidBookingCancellationSettlement,
    )
  })

  it("mounts selected package exports once in graph order", async () => {
    const composed = await composeOperatorGraph()
    const moduleNames = composed.modules.map((module) => module.module.name)
    const extensionNames = composed.extensions.map((extension) => extension.extension.name)

    expect(moduleNames).toContain("bookings")
    expect(moduleNames).toContain("finance")
    expect(moduleNames).toContain("catalog")
    expect(extensionNames).toContain("bookings-suppliers")
    expect(extensionNames).toContain("booking-tax")
    expect(extensionNames).toContain("smartbill")
    expect(moduleNames).toContain("plugin-smartbill.graph-runtime")
    expect(new Set(moduleNames).size).toBe(moduleNames.length)
    expect(new Set(extensionNames).size).toBe(extensionNames.length)
  })

  it("selects channel-push routes, workflow service, and subscribers exactly once", async () => {
    const runtime = createGeneratedGraphRuntime()
    const channelPush = runtime.extensions.find(
      (unit) => unit.id === "@voyant-travel/distribution#channel-push-extension",
    )
    const composed = await composeOperatorGraph()
    const channelPushExtension = composed.extensions.find(
      (extension) => extension.extension.name === "channel-push",
    )
    const channelPushRuntime = composed.modules.find(
      (module) => module.module.name === "distribution.channel-push-extension.graph-runtime",
    )

    expect(
      channelPush?.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.entityId),
    ).toEqual([
      "@voyant-travel/distribution#subscriber.channel-push-availability-changed",
      "@voyant-travel/distribution#subscriber.channel-push-booking-confirmed",
      "@voyant-travel/distribution#subscriber.channel-push-content-changed",
    ])
    expect(channelPushRuntime?.module.bootstrap).toBeTypeOf("function")
    expect(
      composed.extensions.filter((extension) => extension.extension.name === "channel-push"),
    ).toHaveLength(1)
    expect(
      composed.modules.filter(
        (module) => module.module.name === "distribution.channel-push-extension.graph-runtime",
      ),
    ).toHaveLength(1)
    expect(operatorGraphRuntimeBindings).not.toHaveProperty(
      "@voyant-travel/distribution#channel-push-extension",
    )
    expect(buildOperatorRuntimePorts()).toHaveProperty(channelPushRuntimePort.id)

    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const container = createContainer()
    const context = {
      bindings: { DATABASE_URL: "postgres://example.invalid/voyant" },
      container,
      eventBus,
    }
    await channelPushExtension?.extension.bootstrap?.(context)
    await channelPushRuntime?.module.bootstrap?.(context)

    expect(container.has(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY)).toBe(true)
    expect(subscribe.mock.calls.map(([eventType]) => eventType).sort()).toEqual([
      "availability.slot.changed",
      "booking.confirmed",
      "product.content.changed",
    ])
  })

  it("omits channel-push routes and subscriber runtime when deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const composed = await composeVoyantGraphRuntime({
      runtime: {
        ...runtime,
        extensions: runtime.extensions.filter(
          (unit) => unit.id !== "@voyant-travel/distribution#channel-push-extension",
        ),
      },
      capabilities: buildOperatorProviders(),
      bindings: operatorGraphRuntimeBindings,
      ports: buildOperatorRuntimePorts(),
    })

    expect(
      composed.extensions.some((extension) => extension.extension.name === "channel-push"),
    ).toBe(false)
    expect(
      composed.modules.some(
        (module) => module.module.name === "distribution.channel-push-extension.graph-runtime",
      ),
    ).toBe(false)
  })

  it("registers the selected Finance booking-schedule subscriber exactly once", async () => {
    const composed = await composeOperatorGraph()
    const runtimeModule = composed.modules.find(
      (module) => module.module.name === "finance.booking-schedule-extension.graph-runtime",
    )
    const extension = composed.extensions.find(
      (candidate) => candidate.extension.name === "booking-schedule",
    )
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const container = createContainer()
    const context = { bindings: { DATABASE_URL: "postgres://test" }, container, eventBus }

    await runtimeModule?.module.bootstrap?.(context)
    await extension?.extension.bootstrap?.(context)

    expect(runtimeModule?.module.bootstrap).toBeTypeOf("function")
    expect(extension?.extension.bootstrap).toBeTypeOf("function")
    expect(container.has(BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY)).toBe(true)
    expect(
      subscribe.mock.calls.filter(([eventType]) => eventType === "booking.confirmed"),
    ).toHaveLength(1)
  })

  it("does not lower or bind the Finance subscriber when its extension is deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const composed = await composeVoyantGraphRuntime({
      runtime: {
        ...runtime,
        extensions: runtime.extensions.filter(
          (unit) => unit.id !== "@voyant-travel/finance#booking-schedule-extension",
        ),
      },
      capabilities: buildOperatorProviders(),
      bindings: operatorGraphRuntimeBindings,
      ports: buildOperatorRuntimePorts(),
    })

    expect(
      composed.modules.some(
        (module) => module.module.name === "finance.booking-schedule-extension.graph-runtime",
      ),
    ).toBe(false)
    expect(
      composed.extensions.some((extension) => extension.extension.name === "booking-schedule"),
    ).toBe(false)
  })

  it("selects SmartBill package subscribers and binds only its operator adapter", async () => {
    expect(GENERATED_GRAPH_RUNTIME_PLUGIN_IDS).toContain("@voyant-travel/plugin-smartbill")
    expect(operatorGraphRuntimeBindings).toHaveProperty("@voyant-travel/plugin-smartbill")

    const runtime = createGeneratedGraphRuntime()
    const smartbill = runtime.plugins.find((unit) => unit.id === "@voyant-travel/plugin-smartbill")
    const composed = await composeOperatorGraph()
    const runtimeModule = composed.modules.find(
      (module) => module.module.name === "plugin-smartbill.graph-runtime",
    )

    expect(
      smartbill?.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.entityId),
    ).toEqual([
      "@voyant-travel/plugin-smartbill#subscriber.invoice-issued",
      "@voyant-travel/plugin-smartbill#subscriber.payment-recorded",
      "@voyant-travel/plugin-smartbill#subscriber.proforma-issued",
    ])
    expect(runtimeModule?.module.bootstrap).toBeTypeOf("function")

    const subscribe = vi.fn((_eventType: string) => ({ unsubscribe: vi.fn() }))
    await runtimeModule?.module.bootstrap?.({
      bindings: {},
      container: createContainer(),
      eventBus: { subscribe } as never,
    })
    expect(subscribe.mock.calls.map(([eventType]) => eventType)).toEqual([
      "invoice.issued",
      "invoice.payment.recorded",
      "invoice.proforma.issued",
    ])
  })

  it("graph-gates the Trips payment subscriber and its runtime service", async () => {
    const runtime = createGeneratedGraphRuntime()
    const trips = runtime.modules.find((unit) => unit.id === "@voyant-travel/trips")
    const composed = await composeOperatorGraph(runtime)
    const tripsModule = composed.modules.find((module) => module.module.name === "trips")
    const tripsSubscriberModule = composed.modules.find(
      (module) => module.module.name === "trips.graph-runtime",
    )
    const container = createContainer()
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")

    expect(
      trips?.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.entityId),
    ).toEqual(["@voyant-travel/trips#subscriber.payment-completed"])
    expect(tripsSubscriberModule?.module.bootstrap).toBeTypeOf("function")

    await tripsModule?.module.bootstrap?.({
      bindings: {} as AppBindings,
      container,
      eventBus,
    })
    expect(container.has(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY)).toBe(true)
    await tripsSubscriberModule?.module.bootstrap?.({
      bindings: {} as AppBindings,
      container,
      eventBus,
    })
    expect(subscribe.mock.calls.filter(([event]) => event === "payment.completed")).toHaveLength(1)

    const deselected = {
      ...runtime,
      modules: runtime.modules.filter((unit) => unit.id !== "@voyant-travel/trips"),
    }
    const deselectedComposition = await composeOperatorGraph(deselected)

    expect(deselectedComposition.modules.some((module) => module.module.name === "trips")).toBe(
      false,
    )
    expect(
      deselectedComposition.modules.some((module) => module.module.name === "trips.graph-runtime"),
    ).toBe(false)
  })

  it("selects package-owned bridge units and discovered project modules directly", () => {
    const moduleIds = new Set(GENERATED_GRAPH_RUNTIME_MODULE_IDS)
    const pluginIds = new Set(GENERATED_GRAPH_RUNTIME_PLUGIN_IDS)

    for (const id of [
      "@voyant-travel/charters",
      "@voyant-travel/cruises",
      "@voyant-travel/realtime",
      "@voyant-travel/mice",
    ]) {
      expect(moduleIds).toContain(id)
    }
    expect(GENERATED_GRAPH_RUNTIME_EXTENSION_IDS).toContain("@voyant-travel/mice#booking-extension")

    expect(pluginIds).not.toContain("npm/operator#mcp")
    expect([...moduleIds].filter((id) => id.startsWith("npm/operator#")).sort()).toEqual([
      "npm/operator#invitations",
      "npm/operator#mcp",
      "npm/operator#project-subscribers-links",
      "npm/operator#team",
    ])
  })

  it("composes index-only invitations, team, and MCP modules from generated imports", async () => {
    for (const id of ["npm/operator#invitations", "npm/operator#team", "npm/operator#mcp"]) {
      expect(operatorGraphRuntimeBindings).not.toHaveProperty(id)
    }
    const composed = await composeOperatorGraph()
    const byName = (name: string) => composed.modules.find((module) => module.module.name === name)

    expect(byName("invitations")?.lazyAdminRoutes).toBeTypeOf("function")
    expect(byName("invitations")?.lazyPublicRoutes).toBeTypeOf("function")
    expect(byName("team")?.lazyAdminRoutes).toBeTypeOf("function")
    expect(byName("mcp")?.lazyAdminRoutes).toBeTypeOf("function")
  })

  it("composes graph package and local extensions without legacy duplicates", async () => {
    const composed = await composeOperatorGraph()
    const byName = (name: string) =>
      composed.extensions.find((extension) => extension.extension.name === name)

    expect(byName("channel-push")?.extension.module).toBe("distribution")
    expect(byName("channel-push")?.adminRoutes).toBeDefined()
    expect(byName("booking-tax")?.extension.module).toBe("bookings")
    expect(byName("booking-tax")?.adminRoutes).toBeDefined()
    expect(byName("mice-booking")?.extension.module).toBe("bookings")
    expect(byName("booking-schedule")?.publicPath).toBe("payment-policy")
    expect(byName("proposal")?.publicPath).toBe("proposals")

    for (const id of Object.keys(deploymentLocalExtensions)) {
      expect(operatorGraphRuntimeBindings).toHaveProperty(id)
    }
  })

  it("keeps deployment option wiring package-owned and graph-gated", () => {
    for (const id of [
      ...Object.keys(operatorGraphCompatibilityModules),
      ...Object.keys(operatorGraphCompatibilityExtensions),
    ]) {
      expect(id).not.toMatch(/^@voyant-travel\/operator#/)
      expect(operatorGraphRuntimeBindings).toHaveProperty(id)
    }
    expect(operatorGraphRuntimeBindings).not.toHaveProperty(
      "@voyant-travel/public-document-delivery",
    )
  })

  it("binds channel-push, storage, and realtime by package-declared ports", async () => {
    const ports = buildOperatorRuntimePorts()

    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/storage")
    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/realtime")
    expect(operatorGraphRuntimeBindings).not.toHaveProperty(
      "@voyant-travel/distribution#channel-push-extension",
    )
    expect(Object.keys(ports).sort()).toEqual(
      [channelPushRuntimePort.id, realtimeRuntimePort.id, storageMediaRuntimePort.id].sort(),
    )
    await expect(composeOperatorGraph()).resolves.toBeDefined()
  })

  it("initializes the real operator app from the generated graph runtime", async () => {
    const { app } = await import("./app")

    expect(app.fetch).toBeTypeOf("function")
  })
})
