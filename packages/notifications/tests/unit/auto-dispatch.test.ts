import { createContainer, createEventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import { createNotificationsHonoModule } from "../../src/index.js"
import { bookingDocumentNotificationsService } from "../../src/service-booking-documents.js"

function fakeBindings() {
  return {} as Record<string, unknown>
}

describe("createNotificationsHonoModule — autoConfirmAndDispatch", () => {
  it("does NOT subscribe when autoConfirmAndDispatch is off", async () => {
    const eventBus = createEventBus()
    const container = createContainer()
    const subscribeSpy = vi.spyOn(eventBus, "subscribe")

    const module = createNotificationsHonoModule({
      // resolveDb intentionally omitted — the check requires both anyway.
    })

    await module.module.bootstrap?.({ bindings: fakeBindings(), container, eventBus })

    expect(subscribeSpy).not.toHaveBeenCalled()
  })

  it("only subscribes rule dispatchers when autoConfirmAndDispatch.enabled is false", async () => {
    const eventBus = createEventBus()
    const container = createContainer()
    const subscribeSpy = vi.spyOn(eventBus, "subscribe")

    const module = createNotificationsHonoModule({
      resolveDb: () => ({}) as PostgresJsDatabase,
      autoConfirmAndDispatch: { enabled: false, templateSlug: "booking-confirmation" },
    })

    await module.module.bootstrap?.({ bindings: fakeBindings(), container, eventBus })

    expect(subscribeSpy.mock.calls.map((call) => call[0])).toEqual([
      "booking.confirmed",
      "payment.completed",
      "booking.cancelled",
      "booking.expired",
    ])
  })

  it("does NOT subscribe when resolveDb is missing — guard against partial config", async () => {
    const eventBus = createEventBus()
    const container = createContainer()
    const subscribeSpy = vi.spyOn(eventBus, "subscribe")

    const module = createNotificationsHonoModule({
      autoConfirmAndDispatch: { enabled: true, templateSlug: "booking-confirmation" },
    })

    await module.module.bootstrap?.({ bindings: fakeBindings(), container, eventBus })

    expect(subscribeSpy).not.toHaveBeenCalled()
  })

  it("subscribes to booking.confirmed and forwards to confirmAndDispatchBooking when enabled", async () => {
    const eventBus = createEventBus()
    const container = createContainer()
    const db = { fake: true } as PostgresJsDatabase

    const dispatchSpy = vi
      .spyOn(bookingDocumentNotificationsService, "confirmAndDispatchBooking")
      .mockResolvedValue({
        status: "preview" as const,
        bookingId: "book_abc",
        documents: [],
      })

    const module = createNotificationsHonoModule({
      resolveDb: () => db,
      autoConfirmAndDispatch: {
        enabled: true,
        templateSlug: "booking-confirmation",
        documentTypes: ["invoice", "contract"],
      },
    })

    await module.module.bootstrap?.({ bindings: fakeBindings(), container, eventBus })
    await eventBus.emit("booking.confirmed", {
      bookingId: "book_abc",
      bookingNumber: "BK-001",
      actorId: "user_1",
    })

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const call = dispatchSpy.mock.calls[0]
    expect(call?.[0]).toBe(db) // first arg = db
    expect(call?.[2]).toBe("book_abc") // third arg = bookingId
    expect(call?.[3]).toMatchObject({
      templateSlug: "booking-confirmation",
      documentTypes: ["invoice", "contract"],
    })

    dispatchSpy.mockRestore()
  })

  it("swallows subscriber errors — a failing dispatch never propagates back to the emitter", async () => {
    const eventBus = createEventBus()
    const container = createContainer()
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    vi.spyOn(bookingDocumentNotificationsService, "confirmAndDispatchBooking").mockRejectedValue(
      new Error("boom"),
    )

    const module = createNotificationsHonoModule({
      resolveDb: () => ({}) as PostgresJsDatabase,
      autoConfirmAndDispatch: { enabled: true, templateSlug: "booking-confirmation" },
    })

    await module.module.bootstrap?.({ bindings: fakeBindings(), container, eventBus })

    // emit should resolve cleanly — if the handler threw through, this would
    // await a rejected promise and throw here.
    await expect(
      eventBus.emit("booking.confirmed", {
        bookingId: "book_abc",
        bookingNumber: "BK-001",
        actorId: null,
      }),
    ).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/auto-dispatch failed.*book_abc/))
    errorSpy.mockRestore()
    vi.restoreAllMocks()
  })
})
