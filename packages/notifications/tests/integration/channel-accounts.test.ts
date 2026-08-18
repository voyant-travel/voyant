import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createConversationsDeliveryTruthReader } from "../../src/conversations-runtime.js"
import {
  notificationChannelAccounts,
  notificationDeliveries,
  notificationDeliveryEvents,
  notificationSendOperations,
  smsTransportPolicies,
  smsTransportPolicyEvents,
} from "../../src/schema.js"
import {
  admitRenderedServiceMessage,
  provisionChannelAccount,
  reconcileNotificationDeliveryEvent,
} from "../../src/service-channel-accounts.js"
import {
  getOutboundSmsState,
  inspectInboundSmsAccount,
  projectInboundSmsPolicy,
} from "../../src/service-sms-policy.js"
import type { NotificationProvider, NotificationResult } from "../../src/types.js"
import { createNotificationsTestContext, DB_AVAILABLE } from "./test-helpers.js"

const submitted = vi.fn()
const accepted = new Map<string, NotificationResult>()
let validationFailure: Error | null = null
let inboundIdentity: "unambiguous" | "ambiguous" = "unambiguous"
const adapter: NotificationProvider = {
  name: "fixture-adapter",
  channels: ["email", "sms"],
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
      return {
        health: "healthy",
        inboundCapable: true,
        outboundCapable: true,
        inboundIdentity,
        inboundSourceId: "fixture-inbound",
        attachmentsCapable: false,
      }
    },
  },
}

describe.skipIf(!DB_AVAILABLE)("Channel Account rendered delivery", () => {
  const context = createNotificationsTestContext({ providers: [adapter] })

  beforeEach(() => {
    validationFailure = null
    inboundIdentity = "unambiguous"
  })

  it("moves one fixture-adapter message from pending through accepted to delivered exactly once", async () => {
    accepted.clear()
    submitted.mockReset()
    validationFailure = null
    inboundIdentity = "unambiguous"
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
    await expect(
      createConversationsDeliveryTruthReader().getDeliveryTruth(context.db, [pending.id]),
    ).resolves.toEqual({ [pending.id]: "pending" })
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

  it("rejects Inbox setup for an ambiguous inbound SMS identity", async () => {
    inboundIdentity = "ambiguous"
    await expect(
      provisionChannelAccount(context.db, adapter, {
        channel: "sms",
        address: "+12025550999",
        displayName: "Ambiguous SMS",
        allowedPurposes: ["conversation-reply"],
        inboundCapable: true,
        outboundCapable: true,
      }),
    ).rejects.toThrow("unambiguous")
    expect(await context.db.select().from(notificationChannelAccounts)).toHaveLength(0)
    inboundIdentity = "unambiguous"
  })

  it("enforces account-scoped hard opt-out for staff and automated SMS until a newer opt-in", async () => {
    const account = await provisionChannelAccount(context.db, adapter, {
      channel: "sms",
      address: "+12025550100",
      displayName: "SMS service",
      allowedPurposes: ["conversation-reply", "automated-reminder"],
      inboundCapable: true,
      outboundCapable: true,
    })
    const otherAccount = await provisionChannelAccount(context.db, adapter, {
      channel: "sms",
      address: "+12025550101",
      displayName: "Other SMS service",
      allowedPurposes: ["conversation-reply"],
      inboundCapable: true,
      outboundCapable: true,
    })
    const optOut = {
      version: "1" as const,
      channel: "sms" as const,
      sourceId: "fixture-inbound",
      externalEnvelopeId: "policy-envelope-1",
      externalMessageId: "policy-message-1",
      channelAccountId: account.id,
      receivingAddress: account.normalizedAddress,
      senderAddress: "+12025550123",
      text: "STOP",
      attachments: [],
      policyEvent: "hard_opt_out" as const,
      adapterHandledResponse: true,
      occurredAt: "2026-08-17T10:00:00.000Z",
    }
    await expect(
      inspectInboundSmsAccount(context.db, { ...optOut, sourceId: "unbound-source" }),
    ).resolves.toEqual({ kind: "missing" })
    await projectInboundSmsPolicy(context.db, optOut)
    await projectInboundSmsPolicy(context.db, optOut)
    expect(await context.db.select().from(smsTransportPolicyEvents)).toHaveLength(1)
    expect(await context.db.select().from(smsTransportPolicies)).toHaveLength(1)
    expect(await context.db.select().from(notificationDeliveries)).toHaveLength(0)

    // A replay repairs the projection if a previous non-transactional caller
    // committed the immutable ledger before its current-state write.
    await context.db
      .delete(smsTransportPolicies)
      .where(
        and(
          eq(smsTransportPolicies.channelAccountId, account.id),
          eq(smsTransportPolicies.destinationAddress, optOut.senderAddress),
        ),
      )
    await projectInboundSmsPolicy(context.db, optOut)
    expect(await context.db.select().from(smsTransportPolicies)).toHaveLength(1)
    await expect(
      getOutboundSmsState(context.db, {
        channelAccountId: account.id,
        destinationAddress: optOut.senderAddress,
      }),
    ).resolves.toMatchObject({
      health: "healthy",
      available: true,
      attachmentsCapable: false,
      suppressed: true,
    })

    const command = {
      channelAccountId: account.id,
      to: optOut.senderAddress,
      target: { type: "@voyant-travel/conversations#part", id: "cvpa_policy" },
      purpose: "conversation-reply",
      idempotencyKey: "sms-policy-staff",
      text: "Can we help?",
    }
    await expect(admitRenderedServiceMessage(context.db, [adapter], command)).rejects.toThrow(
      "hard opt-out",
    )
    await expect(
      admitRenderedServiceMessage(context.db, [adapter], {
        ...command,
        purpose: "automated-reminder",
        idempotencyKey: "sms-policy-automated",
      }),
    ).rejects.toThrow("hard opt-out")

    await expect(
      admitRenderedServiceMessage(context.db, [adapter], {
        ...command,
        channelAccountId: otherAccount.id,
        idempotencyKey: "sms-policy-other-account",
      }),
    ).resolves.toMatchObject({ status: "pending" })

    await projectInboundSmsPolicy(context.db, {
      ...optOut,
      externalEnvelopeId: "policy-envelope-older",
      externalMessageId: "policy-message-older",
      text: "START",
      policyEvent: "opt_in",
      adapterHandledResponse: false,
      occurredAt: "2026-08-17T09:59:00.000Z",
    })
    await expect(
      admitRenderedServiceMessage(context.db, [adapter], {
        ...command,
        idempotencyKey: "sms-policy-after-old-opt-in",
      }),
    ).rejects.toThrow("hard opt-out")

    await projectInboundSmsPolicy(context.db, {
      ...optOut,
      externalEnvelopeId: "policy-envelope-2",
      externalMessageId: "policy-message-2",
      text: "START",
      policyEvent: "opt_in",
      adapterHandledResponse: false,
      occurredAt: "2026-08-17T10:01:00.000Z",
    })
    await expect(
      admitRenderedServiceMessage(context.db, [adapter], {
        ...command,
        idempotencyKey: "sms-policy-recovered",
      }),
    ).resolves.toMatchObject({ status: "pending" })
  })

  it("orders equal-time policy conflicts fail-closed under concurrency", async () => {
    const account = await provisionChannelAccount(context.db, adapter, {
      channel: "sms",
      address: "+12025550100",
      displayName: "SMS service",
      allowedPurposes: ["conversation-reply"],
      inboundCapable: true,
      outboundCapable: true,
    })
    const common = {
      version: "1" as const,
      channel: "sms" as const,
      sourceId: "fixture-inbound",
      channelAccountId: account.id,
      receivingAddress: account.normalizedAddress,
      senderAddress: "+12025550123",
      attachments: [],
      adapterHandledResponse: false,
      occurredAt: "2026-08-17T10:00:00.000Z",
    }
    await Promise.all([
      projectInboundSmsPolicy(context.db, {
        ...common,
        externalEnvelopeId: "equal-opt-in-envelope",
        externalMessageId: "equal-opt-in-message",
        text: "START",
        policyEvent: "opt_in",
      }),
      projectInboundSmsPolicy(context.db, {
        ...common,
        externalEnvelopeId: "equal-opt-out-envelope",
        externalMessageId: "equal-opt-out-message",
        text: "STOP",
        policyEvent: "hard_opt_out",
      }),
    ])
    await expect(
      getOutboundSmsState(context.db, {
        channelAccountId: account.id,
        destinationAddress: common.senderAddress,
      }),
    ).resolves.toMatchObject({ suppressed: true })
  })
})
