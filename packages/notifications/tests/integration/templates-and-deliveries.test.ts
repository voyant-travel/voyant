import { describe, expect, it, vi } from "vitest"

import { createNotificationsTestContext, DB_AVAILABLE, json } from "./test-helpers"

describe.skipIf(!DB_AVAILABLE)("Notification templates and deliveries routes", () => {
  const ctx = createNotificationsTestContext()

  it("creates and lists notification templates", async () => {
    const createRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "payment-reminder",
        name: "Payment Reminder",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Reminder for {{ bookingNumber }}",
        textTemplate: "Balance due: {{ amountCents }}",
      }),
    })
    expect(createRes.status).toBe(201)
    const { data } = await createRes.json()
    expect(data.slug).toBe("payment-reminder")

    const listRes = await ctx.request("/templates?status=active")
    expect(listRes.status).toBe(200)
    const body = await listRes.json()
    expect(body.total).toBe(1)
    expect(body.data[0].slug).toBe("payment-reminder")
  })

  it("sends a notification from a template and persists the delivery", async () => {
    const createRes = await ctx.request("/templates", {
      method: "POST",
      ...json({
        slug: "payment-reminder",
        name: "Payment Reminder",
        channel: "email",
        provider: "local",
        status: "active",
        subjectTemplate: "Reminder for {{ bookingNumber }}",
        textTemplate: "Balance due: {{ amountCents }}",
      }),
    })
    const { data: template } = await createRes.json()

    const sendRes = await ctx.request("/send", {
      method: "POST",
      ...json({
        templateId: template.id,
        to: "traveler@example.com",
        data: {
          bookingNumber: "BK-1001",
          amountCents: 30000,
        },
        targetType: "booking",
        targetId: "book_123",
        bookingId: "book_123",
      }),
    })
    expect(sendRes.status).toBe(201)
    const { data } = await sendRes.json()
    expect(data.status).toBe("sent")
    expect(data.templateSlug).toBe("payment-reminder")
    expect(data.fromAddress).toBe("local@example.test")
    expect(data.subject).toBe("Reminder for BK-1001")
    expect(data.textBody).toBe("Balance due: 30000")
    expect(ctx.sink).toHaveBeenCalledOnce()
    expect(ctx.sink).toHaveBeenCalledWith(expect.objectContaining({ from: "local@example.test" }))

    const deliveriesRes = await ctx.request("/deliveries?bookingId=book_123")
    const deliveries = await deliveriesRes.json()
    expect(deliveries.total).toBe(1)
    expect(deliveries.data[0].id).toBe(data.id)
  })
})

describe.skipIf(!DB_AVAILABLE)("Notification delivery sender preflight", () => {
  const providerSend = vi.fn(async () => ({ id: "msg_1", provider: "email-no-sender" }))
  const ctx = createNotificationsTestContext({
    providers: [
      {
        name: "email-no-sender",
        channels: ["email"],
        send: providerSend,
      },
    ],
  })

  it("rejects direct email sends before dispatch when no sender can be resolved", async () => {
    providerSend.mockClear()

    const sendRes = await ctx.request("/send", {
      method: "POST",
      ...json({
        channel: "email",
        provider: "email-no-sender",
        to: "traveler@example.com",
        subject: "Hello",
        text: "Body",
      }),
    })

    expect(sendRes.status).toBe(400)
    const body = await sendRes.json()
    expect(body.error).toContain("No email sender configured")
    expect(providerSend).not.toHaveBeenCalled()

    const deliveriesRes = await ctx.request("/deliveries")
    const deliveries = await deliveriesRes.json()
    expect(deliveries.total).toBe(0)
  })
})
