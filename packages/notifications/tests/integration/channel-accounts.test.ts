import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"

import {
  notificationChannelAccounts,
  notificationDeliveries,
  notificationDeliveryEvents,
  notificationSendOperations,
} from "../../src/schema.js"
import {
  admitRenderedServiceMessage,
  provisionChannelAccount,
  reconcileNotificationDeliveryEvent,
} from "../../src/service-channel-accounts.js"
import type { NotificationProvider, NotificationResult } from "../../src/types.js"
import { createNotificationsTestContext, DB_AVAILABLE } from "./test-helpers.js"

const submitted = vi.fn()
const accepted = new Map<string, NotificationResult>()
let validationFailure: Error | null = null
const adapter: NotificationProvider = {
  name: "fixture-adapter",
  channels: ["email"],
  durableDelivery: {
    protocol: "notification-provider-idempotency-v1",
    async send(payload, context) {
      const prior = accepted.get(context.idempotencyKey)
      if (prior) return prior
      submitted(payload)
      const result = { id: "fixture-message-1", provider: "fixture-adapter" }
      accepted.set(context.idempotencyKey, result)
      return result
    },
  },
  channelAccounts: {
    protocol: "notification-channel-account-v1",
    matches: (adapterRef) => adapterRef.startsWith("fixture-account:"),
    async provision(draft) {
      return {
        adapterRef: `fixture-account:${draft.address.toLowerCase()}`,
        normalizedAddress: draft.address.toLowerCase(),
        displayAddress: draft.address,
      }
    },
    async validate() {
      if (validationFailure) throw validationFailure
      return { health: "healthy", inboundCapable: true, outboundCapable: true }
    },
  },
}

describe.skipIf(!DB_AVAILABLE)("Channel Account rendered delivery", () => {
  const context = createNotificationsTestContext({ providers: [adapter] })

  it("moves one fixture-adapter message from pending through accepted to delivered exactly once", async () => {
    accepted.clear()
    submitted.mockReset()
    validationFailure = null
    const account = await provisionChannelAccount(context.db, adapter, {
      channel: "email",
      address: "Service@Example.test",
      displayName: "Guest service",
      allowedPurposes: ["guest-support"],
      inboundCapable: true,
      outboundCapable: true,
    })
    const listResponse = await context.request("/channel-accounts")
    expect(listResponse.status).toBe(200)
    const listBody = (await listResponse.json()) as { data: Array<Record<string, unknown>> }
    expect(listBody.data[0]).toMatchObject({
      id: account.id,
      displayName: "Guest service",
      health: "healthy",
      outboundCapable: true,
    })
    expect(listBody.data[0]).not.toHaveProperty("adapterRef")
    const command = {
      channelAccountId: account.id,
      to: "guest@example.test",
      target: { type: "@voyant-travel/conversations#thread", id: "thread_1" },
      purpose: "guest-support",
      idempotencyKey: "rendered-message-1",
      subject: "Your request",
      text: "We received your request.",
      sanitizedHtml: "<p>We received your request.</p>",
      attachments: [
        {
          privateHandle: "attachment-store:document_1",
          filename: "details.pdf",
          contentType: "application/pdf",
        },
      ],
      thread: { threadId: "thread_1" },
    }

    const pending = await admitRenderedServiceMessage(context.db, [adapter], command)
    const replay = await admitRenderedServiceMessage(context.db, [adapter], command)
    expect(replay.id).toBe(pending.id)
    expect(pending).toMatchObject({
      status: "pending",
      channelAccountId: account.id,
      qualifiedTargetType: "@voyant-travel/conversations#thread",
      purpose: "guest-support",
    })
    expect(await context.db.select().from(notificationSendOperations)).toHaveLength(1)

    await expect(context.drain()).resolves.toMatchObject({ sent: 1 })
    expect(submitted).toHaveBeenCalledOnce()
    const [acceptedDelivery] = await context.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, pending.id))
    expect(acceptedDelivery).toMatchObject({ status: "accepted", acceptedAt: expect.any(Date) })

    const deliveredEvent = {
      adapterRef: account.adapterRef,
      adapterEventId: "delivery-event-1",
      deliveryId: pending.id,
      status: "delivered" as const,
      occurredAt: new Date("2026-08-17T10:00:00.000Z"),
    }
    const first = await reconcileNotificationDeliveryEvent(context.db, deliveredEvent)
    const duplicate = await reconcileNotificationDeliveryEvent(context.db, deliveredEvent)
    expect(first.created).toBe(true)
    expect(duplicate.created).toBe(false)
    expect(duplicate.delivery).toMatchObject({
      status: "delivered",
      deliveredAt: deliveredEvent.occurredAt,
    })
    expect(await context.db.select().from(notificationDeliveryEvents)).toHaveLength(1)

    await expect(
      reconcileNotificationDeliveryEvent(context.db, {
        ...deliveredEvent,
        adapterRef: "fixture-account:another@example.test",
        adapterEventId: "delivery-event-wrong-account",
      }),
    ).rejects.toThrow("does not belong to the Channel Account")

    const lateAcceptance = await reconcileNotificationDeliveryEvent(context.db, {
      ...deliveredEvent,
      adapterEventId: "delivery-event-late-acceptance",
      status: "accepted",
      occurredAt: new Date("2026-08-17T10:01:00.000Z"),
    })
    expect(lateAcceptance.delivery.status).toBe("delivered")
    expect(await context.db.select().from(notificationDeliveryEvents)).toHaveLength(2)

    const raced = await admitRenderedServiceMessage(context.db, [adapter], {
      ...command,
      idempotencyKey: "rendered-message-raced",
    })
    await reconcileNotificationDeliveryEvent(context.db, {
      adapterRef: account.adapterRef,
      adapterEventId: "delivery-event-before-settlement",
      deliveryId: raced.id,
      status: "bounced",
      occurredAt: new Date("2026-08-17T10:02:00.000Z"),
    })
    await expect(context.drain()).resolves.toMatchObject({ sent: 1 })
    const [racedDelivery] = await context.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, raced.id))
    expect(racedDelivery).toMatchObject({
      status: "bounced",
      providerMessageId: "fixture-message-1",
    })

    const disabled = await context.request(`/channel-accounts/${account.id}/lifecycle`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lifecycle: "disabled" }),
    })
    expect(disabled.status).toBe(200)
    await expect(
      admitRenderedServiceMessage(context.db, [adapter], {
        ...command,
        idempotencyKey: "rendered-message-disabled",
      }),
    ).rejects.toThrow("not active")

    const archived = await context.request(`/channel-accounts/${account.id}/lifecycle`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lifecycle: "archived" }),
    })
    expect(archived.status).toBe(200)
    const invalidReactivation = await context.request(`/channel-accounts/${account.id}/lifecycle`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lifecycle: "active" }),
    })
    expect(invalidReactivation.status).toBe(400)

    validationFailure = new Error("credential=should-not-leak")
    const validationResponse = await context.request(`/channel-accounts/${account.id}/validate`, {
      method: "POST",
    })
    expect(validationResponse.status).toBe(400)
    expect(await validationResponse.text()).not.toContain("should-not-leak")
    const [unavailableAccount] = await context.db
      .select()
      .from(notificationChannelAccounts)
      .where(eq(notificationChannelAccounts.id, account.id))
    expect(unavailableAccount?.health).toBe("unavailable")
  })
})
