import type { bookings } from "@voyant-travel/bookings/schema"
import { createContainer, createEventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import { createNotificationsHonoModule } from "../../src/index.js"
import {
  BOOKING_FULLY_PAID_EVENT,
  type BookingDocumentBundleLifecycleContext,
  bookingDocumentBundleLifecycleService,
  createDefaultBookingDocumentBundlePolicy,
} from "../../src/service-booking-document-lifecycle.js"
import { bookingDocumentNotificationsService } from "../../src/service-booking-documents.js"
import type { BookingDocumentBundleItem } from "../../src/service-shared.js"

const booking = {
  id: "book_123",
  bookingNumber: "BK-123",
  status: "confirmed",
  contactFirstName: "Ana",
  contactLastName: "Popescu",
  contactEmail: "ana@example.com",
  contactPhone: null,
  contactPreferredLanguage: "ro",
  sellCurrency: "EUR",
  sellAmountCents: 120000,
  startDate: null,
  endDate: null,
  personId: "per_123",
  organizationId: "org_123",
} as typeof bookings.$inferSelect

const contractDocument: BookingDocumentBundleItem = {
  key: "legal:ctat_123",
  source: "legal",
  documentType: "contract",
  bookingId: "book_123",
  contractId: "ctr_123",
  invoiceId: null,
  attachmentId: "ctat_123",
  renditionId: null,
  contractStatus: "issued",
  invoiceStatus: null,
  name: "contract.pdf",
  format: "pdf",
  mimeType: "application/pdf",
  storageKey: "contracts/book_123/contract.pdf",
  downloadUrl: "https://files.example/contract.pdf",
  language: "ro",
  metadata: null,
  createdAt: "2026-05-14T10:00:00.000Z",
}

const invoiceDocument: BookingDocumentBundleItem = {
  key: "finance:invr_123",
  source: "finance",
  documentType: "invoice",
  bookingId: "book_123",
  contractId: null,
  invoiceId: "inv_123",
  attachmentId: null,
  renditionId: "invr_123",
  contractStatus: null,
  invoiceStatus: "sent",
  name: "INV-BK-123.pdf",
  format: "pdf",
  mimeType: "application/pdf",
  storageKey: "invoices/inv_123/rendition.pdf",
  downloadUrl: "https://files.example/invoice.pdf",
  language: "ro",
  metadata: null,
  createdAt: "2026-05-14T10:05:00.000Z",
}

function context(
  overrides: Partial<BookingDocumentBundleLifecycleContext> = {},
): BookingDocumentBundleLifecycleContext {
  return {
    trigger: "booking.confirmed",
    event: { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: "user_1" },
    booking,
    customer: {
      email: "ana@example.com",
      firstName: "Ana",
      lastName: "Popescu",
      participantType: "booking_contact",
      isPrimary: true,
    },
    travelers: [
      {
        id: "trav_123",
        firstName: "Ana",
        lastName: "Popescu",
        email: "ana@example.com",
        participantType: "traveler",
        isPrimary: true,
      },
    ],
    items: [
      {
        id: "item_123",
        title: "City tour",
        description: "City tour",
        quantity: 1,
        itemType: "service",
        serviceDate: null,
        sellCurrency: "EUR",
        unitSellAmountCents: 120000,
        totalSellAmountCents: 120000,
        currency: "EUR",
        unitPrice: 1200,
        total: 1200,
      },
    ],
    existingDocuments: [],
    ...overrides,
  }
}

describe("bookingDocumentBundleLifecycleService", () => {
  it("passes resolved booking and customer context to the configured post-confirmation policy", async () => {
    const policy = vi.fn(async (resolved: BookingDocumentBundleLifecycleContext) => ({
      status: "ok" as const,
      bookingId: resolved.booking.id,
      documents: [],
      steps: [{ source: "policy" as const, status: "skipped" as const, reason: "test" }],
    }))

    const result = await bookingDocumentBundleLifecycleService.run(
      {} as PostgresJsDatabase,
      { send: vi.fn(), sendWith: vi.fn(), getProvider: vi.fn() },
      {
        trigger: "booking.confirmed",
        event: { bookingId: booking.id, bookingNumber: booking.bookingNumber, actorId: "user_1" },
      },
      { policy, notificationPolicy: () => false },
      { resolveContext: async () => context() },
    )

    expect(result.status).toBe("ok")
    expect(policy).toHaveBeenCalledOnce()
    expect(policy.mock.calls[0]?.[0]).toMatchObject({
      trigger: "booking.confirmed",
      booking: {
        id: "book_123",
        bookingNumber: "BK-123",
        personId: "per_123",
        organizationId: "org_123",
      },
      customer: {
        email: "ana@example.com",
        participantType: "booking_contact",
      },
      travelers: [
        expect.objectContaining({
          email: "ana@example.com",
          isPrimary: true,
        }),
      ],
    })
  })

  it("surfaces configured document policy failures instead of silently losing them", async () => {
    const result = await bookingDocumentBundleLifecycleService.run(
      {} as PostgresJsDatabase,
      { send: vi.fn(), sendWith: vi.fn(), getProvider: vi.fn() },
      {
        trigger: "booking.confirmed",
        event: { bookingId: booking.id, bookingNumber: booking.bookingNumber },
      },
      {
        policy: () => {
          throw new Error("contract generator unavailable")
        },
        notificationPolicy: () => false,
      },
      { resolveContext: async () => context() },
    )

    expect(result).toMatchObject({
      status: "failed",
      bookingId: "book_123",
      error: "contract generator unavailable",
      steps: [{ source: "policy", status: "failed", reason: "contract generator unavailable" }],
    })
  })

  it("uses host notification policy output when sending the composed bundle", async () => {
    const sendSpy = vi
      .spyOn(bookingDocumentNotificationsService, "sendBookingDocumentsNotification")
      .mockResolvedValue({
        status: "sent",
        bookingId: booking.id,
        recipient: "ana@example.com",
        documents: [contractDocument],
        delivery: {
          id: "delivery_123",
          provider: "local",
        },
      })
    const notificationPolicy = vi.fn(() => ({
      templateSlug: "booking-confirmation",
      documentTypes: ["contract" as const],
    }))

    const result = await bookingDocumentBundleLifecycleService.run(
      {} as PostgresJsDatabase,
      { send: vi.fn(), sendWith: vi.fn(), getProvider: vi.fn() },
      {
        trigger: "booking.confirmed",
        event: { bookingId: booking.id, bookingNumber: booking.bookingNumber },
      },
      {
        policy: (resolved) => ({
          status: "ok",
          bookingId: resolved.booking.id,
          documents: [contractDocument],
          steps: [{ source: "legal", documentType: "contract", status: "existing" }],
        }),
        notificationPolicy,
      },
      { resolveContext: async () => context({ existingDocuments: [contractDocument] }) },
    )

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return

    expect(notificationPolicy).toHaveBeenCalledOnce()
    expect(sendSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      booking.id,
      { templateSlug: "booking-confirmation", documentTypes: ["contract"] },
      { attachmentResolver: undefined, eventBus: undefined },
    )
    expect(result.steps.at(-1)).toEqual({ source: "notification", status: "sent" })

    sendSpy.mockRestore()
  })

  it("surfaces notification policy failures as lifecycle failures", async () => {
    const result = await bookingDocumentBundleLifecycleService.run(
      {} as PostgresJsDatabase,
      { send: vi.fn(), sendWith: vi.fn(), getProvider: vi.fn() },
      {
        trigger: "booking.confirmed",
        event: { bookingId: booking.id, bookingNumber: booking.bookingNumber },
      },
      {
        policy: (resolved) => ({
          status: "ok",
          bookingId: resolved.booking.id,
          documents: [contractDocument],
          steps: [{ source: "legal", documentType: "contract", status: "existing" }],
        }),
        notificationPolicy: () => {
          throw new Error("notification template missing")
        },
      },
      { resolveContext: async () => context({ existingDocuments: [contractDocument] }) },
    )

    expect(result).toMatchObject({
      status: "failed",
      bookingId: booking.id,
      error: "notification template missing",
      steps: [
        { source: "legal", documentType: "contract", status: "existing" },
        { source: "notification", status: "failed", reason: "notification template missing" },
      ],
    })
  })
})

describe("createNotificationsHonoModule documentBundleLifecycle", () => {
  it("does not register lifecycle subscribers outside the selected graph", async () => {
    const eventBus = createEventBus()
    const subscribeSpy = vi.spyOn(eventBus, "subscribe")

    const module = createNotificationsHonoModule({
      resolveDb: () => ({}) as PostgresJsDatabase,
      documentBundleLifecycle: {
        enabled: true,
        notificationPolicy: () => false,
      },
    })

    await module.module.bootstrap?.({
      bindings: {},
      container: createContainer(),
      eventBus,
    })

    expect(subscribeSpy).not.toHaveBeenCalled()
  })
})

describe("createDefaultBookingDocumentBundlePolicy", () => {
  it("runs the fully-paid hook independently without duplicating confirmation artifacts", async () => {
    let documents = [contractDocument]
    const ensureLegalDocuments = vi.fn()
    const ensureFinanceDocuments = vi.fn(async () => {
      documents = [contractDocument, invoiceDocument]
    })

    const policy = createDefaultBookingDocumentBundlePolicy({})
    const result = await policy(
      context({
        trigger: BOOKING_FULLY_PAID_EVENT,
        event: { bookingId: booking.id, paymentSessionId: "ps_123" },
        existingDocuments: documents,
      }),
      {
        refreshDocuments: async () => documents,
        ensureLegalDocuments,
        ensureFinanceDocuments,
      },
    )

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return

    expect(ensureLegalDocuments).not.toHaveBeenCalled()
    expect(ensureFinanceDocuments).toHaveBeenCalledOnce()
    expect(ensureFinanceDocuments.mock.calls[0]?.[1]).toEqual({
      trigger: BOOKING_FULLY_PAID_EVENT,
      documentTypes: ["invoice"],
    })
    expect(result.documents.map((document) => document.key)).toEqual([
      "legal:ctat_123",
      "finance:invr_123",
    ])
    expect(result.steps).toEqual([
      { source: "legal", documentType: "contract", status: "existing" },
      { source: "finance", documentType: "invoice", status: "created" },
    ])
  })
})
