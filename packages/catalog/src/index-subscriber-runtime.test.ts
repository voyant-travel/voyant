import { createContainer, createEventBus } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"
import {
  catalogAvailabilityChangedIndexSubscriber,
  catalogEntityOverlayChangedIndexSubscriber,
  catalogIndexSubscriberRuntimeDescriptors,
  catalogPricingChangedIndexSubscriber,
  catalogProductContentChangedIndexSubscriber,
  catalogProductCreatedIndexSubscriber,
  catalogProductDeletedIndexSubscriber,
  catalogProductUpdatedIndexSubscriber,
  catalogPromotionChangedIndexSubscriber,
  catalogPublicationChangedIndexSubscriber,
} from "./index-subscriber-runtime.js"
import {
  CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY,
  type CatalogProjectionRuntime,
} from "./projection-runtime.js"

function runtimeHarness() {
  const runtime: CatalogProjectionRuntime = {
    reindexEntity: vi.fn(async () => undefined),
    deleteEntity: vi.fn(async () => undefined),
  }
  const container = createContainer()
  const eventBus = createEventBus()
  container.register(CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY, runtime)
  return { runtime, container, eventBus, context: { bindings: {}, container, eventBus } }
}

describe("Catalog index subscriber runtime descriptors", () => {
  it("match the inert package declarations", () => {
    expect(
      catalogIndexSubscriberRuntimeDescriptors.map(({ id, eventType }) => ({ id, eventType })),
    ).toMatchInlineSnapshot(`
        [
          {
            "eventType": "product.created",
            "id": "@voyant-travel/catalog#subscriber.index-product-created",
          },
          {
            "eventType": "product.updated",
            "id": "@voyant-travel/catalog#subscriber.index-product-updated",
          },
          {
            "eventType": "product.deleted",
            "id": "@voyant-travel/catalog#subscriber.delete-product",
          },
          {
            "eventType": "product.content.changed",
            "id": "@voyant-travel/catalog#subscriber.index-product-content-changed",
          },
          {
            "eventType": "availability.slot.changed",
            "id": "@voyant-travel/catalog#subscriber.index-product-availability-changed",
          },
          {
            "eventType": "pricing.rule.changed",
            "id": "@voyant-travel/catalog#subscriber.index-product-pricing-changed",
          },
          {
            "eventType": "product.publication.changed",
            "id": "@voyant-travel/catalog#subscriber.index-product-publication-changed",
          },
          {
            "eventType": "promotion.changed",
            "id": "@voyant-travel/catalog#subscriber.index-product-promotion-changed",
          },
          {
            "eventType": "catalog.entity.overlay.changed",
            "id": "@voyant-travel/catalog#subscriber.index-entity-overlay-changed",
          },
        ]
      `)
  })

  it.each([
    [catalogProductCreatedIndexSubscriber, "product.created"],
    [catalogProductUpdatedIndexSubscriber, "product.updated"],
    [catalogProductContentChangedIndexSubscriber, "product.content.changed"],
  ])("reindexes product id payloads for %s", async (descriptor, eventType) => {
    const harness = runtimeHarness()
    await descriptor.register(harness.context)
    await harness.eventBus.emit(eventType, { id: "product_123", ignored: true })
    expect(harness.runtime.reindexEntity).toHaveBeenCalledWith({
      entityModule: "products",
      entityId: "product_123",
    })
  })

  it("deletes product projections for product.deleted", async () => {
    const harness = runtimeHarness()
    await catalogProductDeletedIndexSubscriber.register(harness.context)
    await harness.eventBus.emit("product.deleted", { id: "product_123" })
    expect(harness.runtime.deleteEntity).toHaveBeenCalledWith({
      entityModule: "products",
      entityId: "product_123",
    })
    expect(harness.runtime.reindexEntity).not.toHaveBeenCalled()
  })

  it.each([
    [catalogAvailabilityChangedIndexSubscriber, "availability.slot.changed"],
    [catalogPricingChangedIndexSubscriber, "pricing.rule.changed"],
    [catalogPublicationChangedIndexSubscriber, "product.publication.changed"],
  ])("reindexes present productId payloads and skips missing ids for %s", async (descriptor, eventType) => {
    const harness = runtimeHarness()
    await descriptor.register(harness.context)
    await harness.eventBus.emit(eventType, { productId: "product_123", ignored: true })
    await harness.eventBus.emit(eventType, { ignored: true })
    await harness.eventBus.emit(eventType, { productId: "" })
    expect(harness.runtime.reindexEntity).toHaveBeenCalledTimes(1)
    expect(harness.runtime.reindexEntity).toHaveBeenCalledWith({
      entityModule: "products",
      entityId: "product_123",
    })
  })

  it("reindexes product-scoped promotions sequentially and skips global changes", async () => {
    const harness = runtimeHarness()
    await catalogPromotionChangedIndexSubscriber.register(harness.context)
    await harness.eventBus.emit("promotion.changed", {
      affected: { kind: "products", productIds: ["product_1", "product_2"] },
    })
    await harness.eventBus.emit("promotion.changed", { affected: { kind: "all" } })
    expect(harness.runtime.reindexEntity).toHaveBeenNthCalledWith(1, {
      entityModule: "products",
      entityId: "product_1",
    })
    expect(harness.runtime.reindexEntity).toHaveBeenNthCalledWith(2, {
      entityModule: "products",
      entityId: "product_2",
    })
    expect(harness.runtime.reindexEntity).toHaveBeenCalledTimes(2)
  })

  it("reindexes overlay changes as scoped projection targets", async () => {
    const harness = runtimeHarness()
    await catalogEntityOverlayChangedIndexSubscriber.register(harness.context)
    await harness.eventBus.emit("catalog.entity.overlay.changed", {
      entity_module: "cruise-ships",
      entity_id: "crsh_123",
      field_path: "name",
      locale: "ro-RO",
      audience: "customer",
      market: "RO",
      occurred_at: "2026-07-22T00:00:00.000Z",
    })

    expect(harness.runtime.reindexEntity).toHaveBeenCalledWith({
      entityModule: "cruise-ships",
      entityId: "crsh_123",
      locale: "ro-RO",
      audience: "customer",
      market: "RO",
    })
  })

  it("skips non-targeting events without resolving a projection runtime", async () => {
    const container = createContainer()
    const eventBus = createEventBus()
    const context = { bindings: {}, container, eventBus }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await catalogAvailabilityChangedIndexSubscriber.register(context)
    await catalogPromotionChangedIndexSubscriber.register(context)

    await eventBus.emit("availability.slot.changed", { slotId: "slot_123" })
    await eventBus.emit("promotion.changed", { affected: { kind: "all" } })

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("rejects malformed direct product payloads before runtime invocation", async () => {
    const harness = runtimeHarness()
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await catalogProductCreatedIndexSubscriber.register(harness.context)
    await harness.eventBus.emit("product.created", {})
    expect(harness.runtime.reindexEntity).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('subscriber error for "product.created"'),
      expect.anything(),
    )
    consoleError.mockRestore()
  })
})
