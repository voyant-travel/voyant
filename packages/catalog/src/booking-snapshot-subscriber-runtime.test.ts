import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it, vi } from "vitest"

import {
  CATALOG_BOOKING_SNAPSHOT_RUNTIME_CONTAINER_KEY,
  type CatalogBookingSnapshotExecutionContext,
  type CatalogBookingSnapshotRuntime,
  catalogBookingConfirmedSnapshotSubscriber,
  catalogBookingSnapshotRuntimePort,
  createCatalogBookingSnapshotSubscriberDescriptor,
} from "./booking-snapshot-subscriber-runtime.js"
import type { CaptureSnapshotInput } from "./services/snapshot-service.js"

function snapshotInput(entityId: string): Omit<CaptureSnapshotInput, "bookingId"> {
  return {
    entityModule: "products",
    entityId,
    sourceKind: "owned",
    frozenPayload: { name: entityId },
    overlayStateAtCapture: {},
  }
}

function runtimeHarness(
  overrides: Partial<CatalogBookingSnapshotExecutionContext> = {},
  captureSnapshotGraph = vi.fn(async () => []),
) {
  const snapshotContext: CatalogBookingSnapshotExecutionContext = {
    db: {} as AnyDrizzleDb,
    sellerOperatorId: "seller_123",
    findBookingProductIds: vi.fn(async () => ["product_1"]),
    buildSnapshotInput: vi.fn(async (productId) => snapshotInput(productId)),
    ...overrides,
  }
  const runtime: CatalogBookingSnapshotRuntime = {
    withContext: async (operation) => operation(snapshotContext),
  }
  const container = createContainer()
  const eventBus = createEventBus()
  container.register(CATALOG_BOOKING_SNAPSHOT_RUNTIME_CONTAINER_KEY, runtime)
  const descriptor = createCatalogBookingSnapshotSubscriberDescriptor({ captureSnapshotGraph })
  return {
    captureSnapshotGraph,
    descriptor,
    eventBus,
    snapshotContext,
    context: { bindings: {}, container, eventBus },
  }
}

describe("Catalog booking snapshot subscriber runtime", () => {
  it("ships an inert descriptor and runtime conformance kit", async () => {
    expect(catalogBookingConfirmedSnapshotSubscriber).toMatchObject({
      id: "@voyant-travel/catalog#subscriber.capture-booking-snapshot",
      eventType: "booking.confirmed",
    })
    await expect(
      assertPortConforms(catalogBookingSnapshotRuntimePort, {
        withContext: async (operation) =>
          operation({
            db: {} as AnyDrizzleDb,
            sellerOperatorId: "seller_123",
            findBookingProductIds: async () => [],
            buildSnapshotInput: async () => null,
          }),
      }),
    ).resolves.toBeUndefined()
    await expect(
      assertPortConforms(catalogBookingSnapshotRuntimePort, {} as never),
    ).rejects.toThrow(/withContext/)
  })

  it("deduplicates booking products and captures the idempotent snapshot graph", async () => {
    const harness = runtimeHarness({
      findBookingProductIds: vi.fn(async () => [
        "product_1",
        null,
        "product_1",
        "product_2",
        undefined,
      ]),
    })
    await harness.descriptor.register(harness.context)
    await harness.eventBus.emit("booking.confirmed", {
      bookingId: "booking_123",
      bookingNumber: "B-123",
      actorId: null,
      ignored: true,
    })

    expect(harness.snapshotContext.buildSnapshotInput).toHaveBeenNthCalledWith(1, "product_1", {
      sellerOperatorId: "seller_123",
      scope: {
        locale: "en-GB",
        audience: "staff",
        market: "default",
        actor: "staff",
      },
    })
    expect(harness.snapshotContext.buildSnapshotInput).toHaveBeenNthCalledWith(2, "product_2", {
      sellerOperatorId: "seller_123",
      scope: {
        locale: "en-GB",
        audience: "staff",
        market: "default",
        actor: "staff",
      },
    })
    expect(harness.captureSnapshotGraph).toHaveBeenCalledWith(
      harness.snapshotContext.db,
      "booking_123",
      [snapshotInput("product_1"), snapshotInput("product_2")],
    )
  })

  it("does nothing when the booking has no product items", async () => {
    const harness = runtimeHarness({ findBookingProductIds: vi.fn(async () => []) })
    await harness.descriptor.register(harness.context)
    await harness.eventBus.emit("booking.confirmed", { bookingId: "missing_booking" })
    expect(harness.snapshotContext.buildSnapshotInput).not.toHaveBeenCalled()
    expect(harness.captureSnapshotGraph).not.toHaveBeenCalled()
  })

  it("skips missing products when no snapshot inputs can be built", async () => {
    const harness = runtimeHarness({ buildSnapshotInput: vi.fn(async () => null) })
    await harness.descriptor.register(harness.context)
    await harness.eventBus.emit("booking.confirmed", { bookingId: "booking_123" })
    expect(harness.captureSnapshotGraph).not.toHaveBeenCalled()
  })

  it("leaves snapshot errors to the event bus without retrying or translating them", async () => {
    const captureSnapshotGraph = vi.fn(async () => {
      throw new Error("snapshot insert failed")
    })
    const harness = runtimeHarness({}, captureSnapshotGraph)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await harness.descriptor.register(harness.context)
    await harness.eventBus.emit("booking.confirmed", { bookingId: "booking_123" })
    expect(captureSnapshotGraph).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('subscriber error for "booking.confirmed"'),
      expect.objectContaining({ message: "snapshot insert failed" }),
    )
    consoleError.mockRestore()
  })

  it("validates bookingId before resolving runtime context", async () => {
    const harness = runtimeHarness()
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await harness.descriptor.register(harness.context)
    await harness.eventBus.emit("booking.confirmed", { bookingNumber: "B-123" })
    expect(harness.captureSnapshotGraph).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
