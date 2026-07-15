// agent-quality: file-size exception -- owner: operator; graph composition coverage.
import {
  actionLedgerBookingDriftRuntimePort,
  actionLedgerFinanceDriftRuntimePort,
  actionLedgerInventoryDriftRuntimePort,
} from "@voyant-travel/action-ledger/graph-runtime"
import {
  bookingsAccommodationRuntimePort,
  bookingsConfigurationRuntimePort,
  bookingsFinanceRuntimePort,
  bookingsInventoryRuntimePort,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import {
  catalogBookingRuntimePort,
  catalogContentRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "@voyant-travel/catalog/graph-runtime"
import { BULK_REINDEX_SERVICE_KEY } from "@voyant-travel/commerce"
import { catalogCheckoutApiRuntimePort } from "@voyant-travel/commerce/catalog-checkout-subscribers"
import { bookingMaintenanceRuntimePort } from "@voyant-travel/commerce/checkout"
import {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "@voyant-travel/commerce/promotion-redemption-subscriber"
import { createContainer, createEventBus } from "@voyant-travel/core"
import {
  CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY,
  channelPushRuntimePort,
} from "@voyant-travel/distribution"
import {
  financeAccommodationsPaymentPolicyRuntimePort,
  financeCruisesPaymentPolicyRuntimePort,
  financeDistributionPaymentPolicyRuntimePort,
  financeHostRuntimePort,
  financeInventoryPaymentPolicyRuntimePort,
  financeNotificationsRuntimePort,
  financeOperatorSettingsRuntimePort,
} from "@voyant-travel/finance"
import { BOOKING_SCHEDULE_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/finance/booking-schedule-subscriber"
import { flightsRuntimePort } from "@voyant-travel/flights"
import { composeVoyantGraphRuntime } from "@voyant-travel/framework"
import {
  inventoryBrochureRuntimePort,
  inventoryRuntimePort,
} from "@voyant-travel/inventory/graph-runtime"
import { legalContractDocumentRuntimePort, legalRuntimePort } from "@voyant-travel/legal"
import {
  LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY,
  legalBookingContractSubscriberRuntimePort,
} from "@voyant-travel/legal/booking-contract-subscriber"
import { miceRuntimePort } from "@voyant-travel/mice"
import {
  NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY,
  notificationsRuntimePort,
} from "@voyant-travel/notifications"
import {
  quotesProposalRuntimePort,
  quotesRuntimePort,
  quotesSnapshotRuntimePort,
} from "@voyant-travel/quotes"
import { realtimeRuntimePort } from "@voyant-travel/realtime"
import { relationshipsRouteRuntimePort } from "@voyant-travel/relationships/voyant"
import { storageMediaRuntimePort } from "@voyant-travel/storage/routes"
import {
  storefrontBookingIntentsRuntimePort,
  storefrontCustomerPortalRuntimePort,
  storefrontIntakeRuntimePort,
  storefrontOffersRuntimePort,
  storefrontPaymentLinkRuntimePort,
  storefrontVerificationRuntimePort,
} from "@voyant-travel/storefront"
import { STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY } from "@voyant-travel/storefront/booking-bootstrap-subscriber"
import { TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/trips/payment-subscribers"
import { tripsDatabaseRuntimePort, tripsRoutesRuntimePort } from "@voyant-travel/trips/voyant"
import {
  WorkflowRunnerRegistry,
  workflowRunnerRegistryRuntimePort,
} from "@voyant-travel/workflow-runs"
import { describe, expect, it, vi } from "vitest"

import {
  createGeneratedGraphRuntime,
  createGeneratedStaticTestDeploymentResources,
  createGeneratedTestDeploymentResources,
  GENERATED_GRAPH_RUNTIME_EXTENSION_IDS,
  GENERATED_GRAPH_RUNTIME_MODULE_IDS,
  GENERATED_GRAPH_RUNTIME_PLUGIN_IDS,
} from "./generated-project-runtime.js"

const buildOperatorProviders = () => createGeneratedStaticTestDeploymentResources().capabilities
const buildOperatorRuntimePorts = () => createGeneratedStaticTestDeploymentResources().ports
const buildSelectedOperatorRuntimePorts = async (runtime = createGeneratedGraphRuntime()) =>
  (await createGeneratedTestDeploymentResources(runtime)).ports

async function composeOperatorGraph(runtime = createGeneratedGraphRuntime()) {
  return composeVoyantGraphRuntime({
    runtime,
    capabilities: buildOperatorProviders(),
    ports: await buildSelectedOperatorRuntimePorts(runtime),
  })
}

describe("selected Operator graph runtime composition", () => {
  it("supplies request-scoped checkout options through the declared runtime port", async () => {
    expect(await buildOperatorRuntimePorts()[catalogCheckoutApiRuntimePort.id]).toEqual(
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
    expect(moduleNames).not.toContain("smartbill")
    expect(moduleNames).not.toContain("plugin-smartbill.graph-runtime")
    const duplicateModules = composed.modules
      .filter(({ module }, index) => moduleNames.indexOf(module.name) !== index)
      .map(({ id, module }) => ({ id, name: module.name }))
    expect(duplicateModules).toEqual([])
    expect(extensionNames.filter((name, index) => extensionNames.indexOf(name) !== index)).toEqual(
      [],
    )
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
      ports: await buildSelectedOperatorRuntimePorts(runtime),
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
      ports: await buildSelectedOperatorRuntimePorts(runtime),
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
      "booking.contract.generated",
      "booking.fully-paid",
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
    ).toEqual([3])
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
      ports: {
        ...(await buildSelectedOperatorRuntimePorts(runtime)),
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
    await extension?.extension.bootstrap?.(context)
    await runtimeModule?.module.bootstrap?.(context)

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
      ports: await buildSelectedOperatorRuntimePorts(runtime),
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
  })

  it("graph-gates the Trips payment subscriber and its runtime service", async () => {
    const runtime = createGeneratedGraphRuntime()
    const trips = runtime.modules.find((unit) => unit.id === "@voyant-travel/trips")
    const composed = await composeOperatorGraph(runtime)
    const tripsModules = composed.modules.filter((module) => module.module.name === "trips")
    const tripsModule = tripsModules[0]
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
    expect(tripsModules).toHaveLength(1)
    expect(tripsModule?.module.requiresTransactionalDb).toBe(true)
    expect(tripsModule?.adminRoutes).toBeDefined()
    expect(tripsModule?.publicRoutes).toBeDefined()
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
    const ports = await buildSelectedOperatorRuntimePorts(runtime)
    const registry = await ports[workflowRunnerRegistryRuntimePort.id]
    expect(registry).toBeInstanceOf(WorkflowRunnerRegistry)
    if (!(registry instanceof WorkflowRunnerRegistry)) {
      throw new TypeError("The selected graph did not contribute a workflow runner registry.")
    }
    const composed = await composeVoyantGraphRuntime({
      runtime,
      capabilities: buildOperatorProviders(),
      ports,
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
    const runtime = createGeneratedGraphRuntime()
    const ports = await buildSelectedOperatorRuntimePorts(runtime)
    const missingDatabase = Object.fromEntries(
      Object.entries(ports).filter(([id]) => id !== promotionRedemptionDatabaseRuntimePort.id),
    )

    await expect(
      composeVoyantGraphRuntime({
        runtime,
        capabilities: buildOperatorProviders(),
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
      ports: await buildSelectedOperatorRuntimePorts(runtime),
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

  it("resolves package-owned checkout services without a host registry", async () => {
    await expect(composeOperatorGraph()).resolves.toBeDefined()
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
    expect(moduleIds).toContain("@voyant-travel/auth#invitations")
    expect(moduleIds).toContain("@voyant-travel/auth#team")
    expect(moduleIds).toContain("@voyant-travel/mcp")
    expect([...moduleIds].filter((id) => id.startsWith("npm/operator#"))).toEqual([])
  })

  it("composes package-owned invitations/team and the local MCP module", async () => {
    const composed = await composeOperatorGraph()
    const byName = (name: string) => composed.modules.find((module) => module.module.name === name)

    expect(byName("invitations")?.adminRoutes).toBeDefined()
    expect(byName("invitations")?.publicRoutes).toBeDefined()
    expect(byName("team")?.adminRoutes).toBeDefined()
    expect(byName("mcp")?.lazyAdminRoutes).toBeTypeOf("function")
  })

  it("composes graph package extensions without legacy duplicates", async () => {
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
  })

  it("binds host runtimes by package-declared ports instead of package ids", async () => {
    const ports = buildOperatorRuntimePorts()

    expect(Object.keys(ports)).toEqual(
      expect.arrayContaining([
        actionLedgerBookingDriftRuntimePort.id,
        actionLedgerFinanceDriftRuntimePort.id,
        actionLedgerInventoryDriftRuntimePort.id,
        bookingMaintenanceRuntimePort.id,
        bookingsAccommodationRuntimePort.id,
        bookingsConfigurationRuntimePort.id,
        bookingsFinanceRuntimePort.id,
        bookingsInventoryRuntimePort.id,
        bookingsRelationshipsRuntimePort.id,
        catalogBookingRuntimePort.id,
        catalogContentRuntimePort.id,
        catalogOffersRuntimePort.id,
        catalogSearchRuntimePort.id,
        catalogCheckoutApiRuntimePort.id,
        financeAccommodationsPaymentPolicyRuntimePort.id,
        financeCruisesPaymentPolicyRuntimePort.id,
        financeDistributionPaymentPolicyRuntimePort.id,
        financeHostRuntimePort.id,
        financeInventoryPaymentPolicyRuntimePort.id,
        financeNotificationsRuntimePort.id,
        financeOperatorSettingsRuntimePort.id,
        flightsRuntimePort.id,
        inventoryBrochureRuntimePort.id,
        inventoryRuntimePort.id,
        relationshipsRouteRuntimePort.id,
        legalBookingContractSubscriberRuntimePort.id,
        legalContractDocumentRuntimePort.id,
        legalRuntimePort.id,
        miceRuntimePort.id,
        notificationsRuntimePort.id,
        quotesProposalRuntimePort.id,
        quotesRuntimePort.id,
        quotesSnapshotRuntimePort.id,
        realtimeRuntimePort.id,
        storageMediaRuntimePort.id,
        storefrontCustomerPortalRuntimePort.id,
        storefrontBookingIntentsRuntimePort.id,
        storefrontIntakeRuntimePort.id,
        storefrontOffersRuntimePort.id,
        storefrontPaymentLinkRuntimePort.id,
        storefrontVerificationRuntimePort.id,
        promotionRedemptionDatabaseRuntimePort.id,
        promotionsBulkReindexRuntimePort.id,
        channelPushRuntimePort.id,
        tripsDatabaseRuntimePort.id,
        tripsRoutesRuntimePort.id,
      ]),
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
    const runtime = createGeneratedGraphRuntime()
    const selected = await composeOperatorGraph(runtime)
    expect(selected.modules.filter((module) => module.module.name === "flights")).toHaveLength(1)

    const deselected = await composeOperatorGraph({
      ...runtime,
      modules: runtime.modules.filter((unit) => unit.id !== "@voyant-travel/flights"),
    })
    expect(deselected.modules.some((module) => module.module.name === "flights")).toBe(false)
  })
})
