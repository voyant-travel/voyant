import { beforeEach, describe, expect, it, vi } from "vitest"

import type { NotificationService } from "../../src/service.js"
import type { NotificationReminderRuleRow } from "../../src/service-shared.js"

const mocks = vi.hoisted(() => ({
  enqueueNotification: vi.fn(),
  getBookingEventDocumentContext: vi.fn(),
  getBookingPaymentNotificationContext: vi.fn(),
  listBookingNotificationItems: vi.fn(),
  resolveReminderRecipient: vi.fn(),
  serializeBookingPaymentContext: vi.fn(),
}))

vi.mock("../../src/service-durable-send.js", () => ({
  enqueueNotification: mocks.enqueueNotification,
}))

vi.mock("../../src/service-reminder-booking-context.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/service-reminder-booking-context.js")>()
  return {
    ...actual,
    getBookingEventDocumentContext: mocks.getBookingEventDocumentContext,
    getBookingPaymentNotificationContext: mocks.getBookingPaymentNotificationContext,
    serializeBookingPaymentContext: mocks.serializeBookingPaymentContext,
  }
})

vi.mock("../../src/service-shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/service-shared.js")>()
  return {
    ...actual,
    listBookingNotificationItems: mocks.listBookingNotificationItems,
    resolveReminderRecipient: mocks.resolveReminderRecipient,
  }
})

const booking = {
  id: "book_1",
  bookingNumber: "BK-1",
  status: "confirmed",
  startDate: "2026-08-01",
  endDate: "2026-08-08",
  sellCurrency: "EUR",
  sellAmountCents: 120000,
  personId: "person_1",
  organizationId: null,
}

const traveler = {
  id: "trav_1",
  firstName: "Ava",
  lastName: "Ionescu",
  email: "ava@example.test",
  participantType: "primary",
  isPrimary: true,
}

function createRule(targetType: NotificationReminderRuleRow["targetType"]) {
  return {
    id: `rule_${targetType}`,
    targetType,
    channel: "email",
    provider: null,
    templateId: null,
    templateSlug: `${targetType}_template`,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as NotificationReminderRuleRow
}

function selectOrderByResult(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(async () => rows),
      })),
    })),
  }
}

function selectLimitResult(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  }
}

function createDb(rule: NotificationReminderRuleRow) {
  const select = vi
    .fn()
    .mockReturnValueOnce(selectOrderByResult([rule]))
    .mockReturnValueOnce(selectLimitResult([]))
    .mockReturnValueOnce(selectLimitResult([booking]))
    .mockReturnValueOnce(selectOrderByResult([traveler]))
  const returning = vi.fn(async () => [
    {
      id: `run_${rule.targetType}`,
      dedupeKey: `${rule.id}:book_1:${rule.targetType}`,
    },
  ])
  const onConflictDoNothing = vi.fn(() => ({ returning }))
  const values = vi.fn(() => ({ onConflictDoNothing }))
  const insert = vi.fn(() => ({ values }))

  return { db: { select, insert }, values }
}

describe("dispatchReminderEventRules", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enqueueNotification.mockResolvedValue({ id: "delivery_1" })
    mocks.getBookingEventDocumentContext.mockResolvedValue({
      documents: [{ key: "voucher", name: "Voucher" }],
      attachments: [{ filename: "voucher.pdf", contentBase64: "ZmFrZQ==" }],
    })
    mocks.getBookingPaymentNotificationContext.mockResolvedValue({})
    mocks.listBookingNotificationItems.mockResolvedValue([{ id: "item_1", title: "Tour" }])
    mocks.resolveReminderRecipient.mockReturnValue(traveler)
    mocks.serializeBookingPaymentContext.mockReturnValue({
      invoice: null,
      paymentSchedule: null,
      paymentSession: null,
    })
  })

  it.each([
    ["booking_confirmed", undefined],
    ["payment_complete", "pay_1"],
    ["booking_cancelled_non_payment", undefined],
  ] as const)("includes configured portal data for event-driven %s reminders", async (targetType, paymentSessionId) => {
    const { dispatchReminderEventRules } = await import("../../src/service-reminder-events.js")
    const rule = createRule(targetType)
    const { db } = createDb(rule)

    await dispatchReminderEventRules(
      db as never,
      {} as NotificationService,
      {
        targetType,
        bookingId: booking.id,
        paymentSessionId,
        eventData: { bookingId: booking.id },
      },
      { publicCustomerPortalBaseUrl: " https://portal.example.test/ " },
    )

    expect(mocks.enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          data: expect.objectContaining({
            portal: {
              url: "https://portal.example.test",
              bookingUrl: "https://portal.example.test/bookings/book_1",
            },
          }),
        }),
      }),
    )
  })

  it.each([
    ["booking_confirmed", undefined],
    ["payment_complete", "pay_1"],
    ["booking_cancelled_non_payment", undefined],
  ] as const)("includes empty portal data for event-driven %s reminders when no portal URL is configured", async (targetType, paymentSessionId) => {
    const { dispatchReminderEventRules } = await import("../../src/service-reminder-events.js")
    const rule = createRule(targetType)
    const { db } = createDb(rule)

    await dispatchReminderEventRules(
      db as never,
      {} as NotificationService,
      {
        targetType,
        bookingId: booking.id,
        paymentSessionId,
        eventData: { bookingId: booking.id },
      },
      {},
    )

    expect(mocks.enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          data: expect.objectContaining({
            portal: { url: "", bookingUrl: "" },
          }),
        }),
      }),
    )
  })

  it("preserves booking-confirmed document attachments", async () => {
    const { dispatchReminderEventRules } = await import("../../src/service-reminder-events.js")
    const rule = createRule("booking_confirmed")
    const { db } = createDb(rule)

    await dispatchReminderEventRules(
      db as never,
      {} as NotificationService,
      { targetType: "booking_confirmed", bookingId: booking.id },
      { publicCustomerPortalBaseUrl: "https://portal.example.test" },
    )

    expect(mocks.enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          attachments: [{ filename: "voucher.pdf", contentBase64: "ZmFrZQ==" }],
          metadata: expect.objectContaining({ bookingDocumentKeys: ["voucher"] }),
        }),
      }),
    )
  })
})
