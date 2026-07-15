import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type NotificationsToolServices, notificationsTools } from "../src/tools.js"

const occurredAt = new Date("2026-07-15T10:00:00.000Z")

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    id: "ndl_1",
    templateId: "ntp_1",
    templateSlug: "booking-confirmed",
    targetType: "booking",
    targetId: "bk_1",
    personId: null,
    organizationId: null,
    bookingId: "bk_1",
    invoiceId: null,
    paymentSessionId: null,
    channel: "email",
    provider: "resend",
    providerMessageId: "msg_1",
    status: "sent",
    toAddress: "guest@example.com",
    fromAddress: "bookings@example.com",
    subject: "Booking confirmed",
    htmlBody: "<p>Your booking is confirmed.</p>",
    textBody: "Your booking is confirmed.",
    payloadData: { bookingId: "bk_1" },
    metadata: { category: "transactional" },
    errorMessage: null,
    scheduledFor: null,
    sentAt: occurredAt,
    failedAt: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    ...overrides,
  }
}

function ctx(
  services?: Partial<NotificationsToolServices>,
): ToolContext & { notifications?: NotificationsToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    notifications: services as NotificationsToolServices | undefined,
  }
}

describe("notifications tools", () => {
  it("registers read tools (notifications:read) + a constrained send (notifications:send)", () => {
    const registry = createToolRegistry()
    registry.registerAll(notificationsTools)
    const list = registry.list()
    expect(list.map((t) => t.name).sort()).toEqual([
      "get_notification_delivery",
      "list_notification_deliveries",
      "send_notification",
    ])
    const send = list.find((t) => t.name === "send_notification")
    expect(send?.tier).toBe("destructive")
    expect(send?.requiredScopes).toEqual(["notifications:send"])
    expect(send?.riskPolicy).toMatchObject({ destructive: true, confirmationRequired: true })
    // The send tool must NOT accept arbitrary content — only a vetted template slug.
    const props = (send?.inputSchema as { properties?: Record<string, unknown> }).properties ?? {}
    expect(props).toHaveProperty("templateSlug")
    expect(props).not.toHaveProperty("html")
    expect(props).not.toHaveProperty("subject")
    for (const t of list.filter((x) => x.name !== "send_notification")) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["notifications:read"])
    }
  })

  it("sends only through the injected template dispatcher", async () => {
    const registry = createToolRegistry()
    registry.registerAll(notificationsTools)
    let sent: unknown
    const result = await registry.dispatch(
      "send_notification",
      { templateSlug: "booking-confirmed", to: "guest@example.com", bookingId: "bk_1" },
      ctx({
        async listDeliveries() {
          return { data: [], total: 0, limit: 50, offset: 0 }
        },
        async getDeliveryById() {
          return null
        },
        async sendTemplated(input) {
          sent = input
          return delivery({ id: "ndl_9" })
        },
      }),
    )
    expect(result).toMatchObject({ id: "ndl_9", status: "sent" })
    expect(sent).toMatchObject({ templateSlug: "booking-confirmed", to: "guest@example.com" })
  })

  it("dispatches delivery reads through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(notificationsTools)
    const result = await registry.dispatch(
      "get_notification_delivery",
      { id: "ndl_1" },
      ctx({
        async listDeliveries() {
          return { data: [], total: 0, limit: 50, offset: 0 }
        },
        async getDeliveryById(id) {
          return delivery({ id })
        },
      }),
    )
    expect(result).toMatchObject({ id: "ndl_1" })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(notificationsTools)
    await expect(
      registry.dispatch("list_notification_deliveries", {}, ctx(undefined)),
    ).rejects.toMatchObject({ code: "MISSING_SERVICE" })
  })
})
