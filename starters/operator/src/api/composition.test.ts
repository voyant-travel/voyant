import { BULK_REINDEX_SERVICE_KEY } from "@voyant-travel/commerce"
import { catalogCheckoutApiRuntimePort } from "@voyant-travel/commerce/catalog-checkout-subscribers"
import {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "@voyant-travel/commerce/promotion-redemption-subscriber"
import { createContainer, createEventBus } from "@voyant-travel/core"
import {
  CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY,
  channelPushRuntimePort,
} from "@voyant-travel/distribution"
import { BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/finance/booking-schedule-subscriber"
import { flightsRuntimePort } from "@voyant-travel/flights"
import { composeVoyantGraphRuntime } from "@voyant-travel/framework"
import { legalRuntimePort } from "@voyant-travel/legal"
import {
  LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY,
  legalBookingContractSubscriberRuntimePort,
} from "@voyant-travel/legal/booking-contract-subscriber"
import {
  NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY,
  notificationsRuntimePort,
} from "@voyant-travel/notifications"
import { realtimeRuntimePort } from "@voyant-travel/realtime"
import { relationshipsRouteRuntimePort } from "@voyant-travel/relationships/voyant"
import { storageMediaRuntimePort } from "@voyant-travel/storage/routes"
import { STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY } from "@voyant-travel/storefront/booking-bootstrap-subscriber"
import { TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/trips/payment-subscribers"
import { WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"
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
  const workflowRunnerRegistry = new WorkflowRunnerRegistry()
  return composeVoyantGraphRuntime({
    runtime,
    capabilities: buildOperatorProviders(),
    bindings: operatorGraphRuntimeBindings,
    ports: buildOperatorRuntimePorts(workflowRunnerRegistry),
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

  it("supplies request-scoped checkout options through the declared runtime port", () => {
    expect(buildOperatorRuntimePorts()[catalogCheckoutApiRuntimePort.id]).toEqual(
      expect.any(Function),
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

  it("lowers Bookings route access resources from the selected graph", async () => {
    const composed = await composeOperatorGraph()

    expect(composed.accessResources).toEqual(
      expect.arrayContaining([
        { path: "/v1/admin/bookings", resource: "bookings" },
        { path: "/v1/public/bookings", resource: "bookings" },
      ]),
    )
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
      ports: buildOperatorRuntimePorts(new WorkflowRunnerRegistry()),
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

  it("registers selected Notifications subscribers once with confirmation priority", async () => {
    const composed = await composeOperatorGraph()
    const notificationsModule = composed.modules.find(
      (module) => module.module.name === "notifications",
    )
    const subscriberRuntimeModule = composed.modules.find(
      (module) =>
        module.module.name === "notifications.reminder-subscribers-extension.graph-runtime",
    )
    const subscriberExtension = composed.extensions.find(
      (extension) => extension.extension.name === "notifications-reminder-subscribers",
    )
    const container = createContainer()
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const context = { bindings: {} as AppBindings, container, eventBus }

    await notificationsModule?.module.bootstrap?.(context)
    await subscriberExtension?.extension.bootstrap?.(context)
    await subscriberRuntimeModule?.module.bootstrap?.(context)

    expect(subscriberExtension?.extension.bootstrap).toBeTypeOf("function")
    expect(container.has(NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY)).toBe(true)
    expect(subscribe.mock.calls.map(([eventType]) => eventType)).toEqual([
      "booking.confirmed",
      "booking.cancelled",
      "booking.confirmed",
      "booking.expired",
      "payment.completed",
    ])
    expect(
      subscribe.mock.calls
        .map(([eventType], index) => ({ eventType, index }))
        .filter(({ eventType }) => eventType === "booking.confirmed")
        .map(({ index }) => index),
    ).toEqual([0, 2])
  })

  it("removes Notifications subscriber services and handlers when deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const composed = await composeOperatorGraph({
      ...runtime,
      extensions: runtime.extensions.filter(
        (unit) => unit.id !== "@voyant-travel/notifications#reminder-subscribers-extension",
      ),
    })

    expect(
      composed.modules.some(
        (module) =>
          module.module.name === "notifications.reminder-subscribers-extension.graph-runtime",
      ),
    ).toBe(false)
    expect(
      composed.extensions.some(
        (extension) => extension.extension.name === "notifications-reminder-subscribers",
      ),
    ).toBe(false)
  })

  it("registers the selected Legal booking-contract subscriber exactly once", async () => {
    const runtime = createGeneratedGraphRuntime()
    const legal = runtime.extensions.find(
      (unit) => unit.id === "@voyant-travel/legal#booking-contract-extension",
    )
    const composed = await composeVoyantGraphRuntime({
      runtime,
      capabilities: buildOperatorProviders(),
      bindings: operatorGraphRuntimeBindings,
      ports: {
        ...buildOperatorRuntimePorts(),
        [legalBookingContractSubscriberRuntimePort.id]: {
          createRuntime: () => ({
            options: { enabled: true, templateSlug: "customer-sales-agreement" },
            withDb: vi.fn(),
            documentGenerator: vi.fn(),
            resolveActionLedgerContext: vi.fn(() => null),
          }),
        },
      },
    })
    const runtimeModule = composed.modules.find(
      (module) => module.module.name === "legal.booking-contract-extension.graph-runtime",
    )
    const extension = composed.extensions.find(
      (candidate) => candidate.extension.name === "booking-contract",
    )
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const container = createContainer()
    const context = { bindings: { DATABASE_URL: "postgres://test" }, container, eventBus }

    expect(
      legal?.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.entityId),
    ).toEqual(["@voyant-travel/legal#subscriber.booking-contract-confirmed"])
    await runtimeModule?.module.bootstrap?.(context)
    await extension?.extension.bootstrap?.(context)

    expect(runtimeModule?.module.bootstrap).toBeTypeOf("function")
    expect(extension?.extension.bootstrap).toBeTypeOf("function")
    expect(container.has(LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY)).toBe(true)
    expect(
      subscribe.mock.calls.filter(([eventType]) => eventType === "booking.confirmed"),
    ).toHaveLength(1)
  })

  it("does not lower or bind the Legal subscriber when its extension is deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const composed = await composeVoyantGraphRuntime({
      runtime: {
        ...runtime,
        extensions: runtime.extensions.filter(
          (unit) => unit.id !== "@voyant-travel/legal#booking-contract-extension",
        ),
      },
      capabilities: buildOperatorProviders(),
      bindings: operatorGraphRuntimeBindings,
      ports: buildOperatorRuntimePorts(),
    })

    expect(
      composed.modules.some(
        (module) => module.module.name === "legal.booking-contract-extension.graph-runtime",
      ),
    ).toBe(false)
    expect(
      composed.extensions.some((extension) => extension.extension.name === "booking-contract"),
    ).toBe(false)
  })

  it("binds Legal runtime services by declared ports instead of package id", () => {
    expect(buildOperatorRuntimePorts()).toHaveProperty(legalBookingContractSubscriberRuntimePort.id)
    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/legal")
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

  it("graph-gates the Storefront booking-bootstrap subscriber and registers it once", async () => {
    const runtime = createGeneratedGraphRuntime()
    const storefrontUnit = runtime.modules.find((unit) => unit.id === "@voyant-travel/storefront")
    const composed = await composeOperatorGraph(runtime)
    const storefront = composed.modules.find((module) => module.module.name === "storefront")
    const subscriberModule = composed.modules.find(
      (module) => module.module.name === "storefront.graph-runtime",
    )
    const container = createContainer()
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const context = { bindings: {} as AppBindings, container, eventBus }

    expect(
      storefrontUnit?.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.entityId),
    ).toEqual(["@voyant-travel/storefront#subscriber.booking-bootstrap"])

    await storefront?.module.bootstrap?.(context)
    expect(container.has(STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY)).toBe(true)
    await subscriberModule?.module.bootstrap?.(context)

    expect(
      subscribe.mock.calls.filter(([event]) => event === "storefront.booking.bootstrap.requested"),
    ).toHaveLength(1)

    const deselected = {
      ...runtime,
      modules: runtime.modules.filter((unit) => unit.id !== "@voyant-travel/storefront"),
    }
    const deselectedComposition = await composeOperatorGraph(deselected)
    expect(
      deselectedComposition.modules.some((module) => module.module.name === "storefront"),
    ).toBe(false)
    expect(
      deselectedComposition.modules.some(
        (module) => module.module.name === "storefront.graph-runtime",
      ),
    ).toBe(false)
  })

  it("activates both selected Commerce checkout subscribers exactly once and registers its runner", async () => {
    const runtime = createGeneratedGraphRuntime()
    const checkout = runtime.extensions.find(
      (unit) => unit.id === "@voyant-travel/commerce#catalog-checkout-extension",
    )
    const registry = new WorkflowRunnerRegistry()
    const composed = await composeVoyantGraphRuntime({
      runtime,
      capabilities: buildOperatorProviders(),
      bindings: operatorGraphRuntimeBindings,
      ports: buildOperatorRuntimePorts(registry),
    })
    const runtimeModule = composed.modules.find(
      (module) => module.module.name === "commerce.catalog-checkout-extension.graph-runtime",
    )
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")

    await runtimeModule?.module.bootstrap?.({
      bindings: { DATABASE_URL: "postgres://test" },
      container: createContainer(),
      eventBus,
    })

    expect(
      checkout?.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.entityId),
    ).toEqual([
      "@voyant-travel/commerce#subscriber.catalog-checkout-contract-document-generated",
      "@voyant-travel/commerce#subscriber.catalog-checkout-payment-completed",
    ])
    expect(
      subscribe.mock.calls.filter(
        ([eventType]) =>
          eventType === "contract.document.generated" || eventType === "payment.completed",
      ),
    ).toHaveLength(2)
    expect(
      subscribe.mock.calls.find(([eventType]) => eventType === "payment.completed")?.[2],
    ).toEqual({ inline: true })
    expect(registry.get("checkout-finalize")).toMatchObject({
      name: "checkout-finalize",
      rerun: expect.any(Function),
      resume: expect.any(Function),
    })
  })

  it("activates the selected Commerce promotion-redemption subscriber exactly once", async () => {
    const runtime = createGeneratedGraphRuntime()
    const commerce = runtime.modules.find((unit) => unit.id === "@voyant-travel/commerce")
    const composed = await composeOperatorGraph(runtime)
    const runtimeModule = composed.modules.find(
      (module) => module.module.name === "commerce.graph-runtime",
    )
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const container = createContainer()

    await runtimeModule?.module.bootstrap?.({
      bindings: { DATABASE_URL: "postgres://test" },
      container,
      eventBus,
    })

    expect(
      commerce?.references.filter(
        (reference) =>
          reference.facet === "subscribers.runtime" &&
          reference.entityId ===
            "@voyant-travel/commerce#subscriber.promotion-redemption-booking-confirmed",
      ),
    ).toHaveLength(1)
    expect(
      subscribe.mock.calls.filter(([eventType]) => eventType === "booking.confirmed"),
    ).toHaveLength(1)
    expect(container.has(BULK_REINDEX_SERVICE_KEY)).toBe(true)
  })

  it("does not lower Commerce promotion services or subscribers when deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const composed = await composeOperatorGraph({
      ...runtime,
      modules: runtime.modules.filter((unit) => unit.id !== "@voyant-travel/commerce"),
    })

    expect(composed.modules.some((module) => module.module.name === "commerce.graph-runtime")).toBe(
      false,
    )
    expect(composed.modules.some((module) => module.module.name === "commerce")).toBe(false)
  })

  it("fails composition when selected Commerce promotions omit a required host port", async () => {
    const ports = buildOperatorRuntimePorts(new WorkflowRunnerRegistry())
    const missingDatabase = Object.fromEntries(
      Object.entries(ports).filter(([id]) => id !== promotionRedemptionDatabaseRuntimePort.id),
    )

    await expect(
      composeVoyantGraphRuntime({
        runtime: createGeneratedGraphRuntime(),
        capabilities: buildOperatorProviders(),
        bindings: operatorGraphRuntimeBindings,
        ports: missingDatabase,
      }),
    ).rejects.toThrow(/requires runtime port "commerce\.promotion-redemption-database"/)
  })

  it("does not lower Commerce checkout subscribers or require their ports when deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const composed = await composeVoyantGraphRuntime({
      runtime: {
        ...runtime,
        extensions: runtime.extensions.filter(
          (unit) => unit.id !== "@voyant-travel/commerce#catalog-checkout-extension",
        ),
      },
      capabilities: buildOperatorProviders(),
      bindings: operatorGraphRuntimeBindings,
      ports: buildOperatorRuntimePorts(),
    })

    expect(
      composed.modules.some(
        (module) => module.module.name === "commerce.catalog-checkout-extension.graph-runtime",
      ),
    ).toBe(false)
    expect(
      composed.extensions.some((extension) => extension.extension.name === "catalog-checkout"),
    ).toBe(false)
  })

  it("fails composition explicitly when a selected checkout host omits a required service", async () => {
    await expect(
      composeVoyantGraphRuntime({
        runtime: createGeneratedGraphRuntime(),
        capabilities: buildOperatorProviders(),
        bindings: operatorGraphRuntimeBindings,
        ports: buildOperatorRuntimePorts(),
      }),
    ).rejects.toThrow(/requires runtime port "workflows\.runner-registry"/)
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

  it("binds host runtimes by package-declared ports instead of package ids", async () => {
    const ports = buildOperatorRuntimePorts(new WorkflowRunnerRegistry())

    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/relationships")
    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/storage")
    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/realtime")
    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/notifications")
    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/legal")
    expect(operatorGraphRuntimeBindings).not.toHaveProperty(
      "@voyant-travel/commerce#catalog-checkout-extension",
    )
    expect(Object.keys(ports)).toEqual(
      expect.arrayContaining([
        catalogCheckoutApiRuntimePort.id,
        flightsRuntimePort.id,
        relationshipsRouteRuntimePort.id,
        legalBookingContractSubscriberRuntimePort.id,
        legalRuntimePort.id,
        notificationsRuntimePort.id,
        realtimeRuntimePort.id,
        storageMediaRuntimePort.id,
        promotionRedemptionDatabaseRuntimePort.id,
        promotionsBulkReindexRuntimePort.id,
        channelPushRuntimePort.id,
      ]),
    )
    expect(operatorGraphRuntimeBindings).not.toHaveProperty(
      "@voyant-travel/distribution#channel-push-extension",
    )
    await expect(composeOperatorGraph()).resolves.toBeDefined()
  })

  it("selects Relationships exactly once and omits it when deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const selected = await composeOperatorGraph(runtime)
    const relationshipsModules = selected.modules.filter(
      (module) => module.module.name === "relationships",
    )

    expect(relationshipsModules).toHaveLength(1)
    expect(relationshipsModules[0]?.module.requiresTransactionalDb).toBe(true)
    expect(selected.routePosture.transactionalPaths).toContain("/v1/admin/relationships")

    const deselected = await composeOperatorGraph({
      ...runtime,
      modules: runtime.modules.filter((unit) => unit.id !== "@voyant-travel/relationships"),
    })
    expect(deselected.modules.some((module) => module.module.name === "relationships")).toBe(false)
    expect(deselected.routePosture.transactionalPaths).not.toContain("/v1/admin/relationships")
  })

  it("composes selected Flights exactly once and omits it when deselected", async () => {
    expect(operatorGraphRuntimeBindings).not.toHaveProperty("@voyant-travel/flights")

    const runtime = createGeneratedGraphRuntime()
    const selected = await composeOperatorGraph(runtime)
    expect(selected.modules.filter((module) => module.module.name === "flights")).toHaveLength(1)

    const deselected = await composeOperatorGraph({
      ...runtime,
      modules: runtime.modules.filter((unit) => unit.id !== "@voyant-travel/flights"),
    })
    expect(deselected.modules.some((module) => module.module.name === "flights")).toBe(false)
  })

  it("initializes the real operator app from the generated graph runtime", async () => {
    const { app } = await import("./app")

    expect(app.fetch).toBeTypeOf("function")
  })
})
