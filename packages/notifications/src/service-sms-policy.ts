import type { InboundSmsEnvelopeV1 } from "@voyant-travel/conversations-contracts"
import { normalizeE164 } from "@voyant-travel/conversations-contracts"
import { newId } from "@voyant-travel/db/lib/typeid"
import { and, eq, lt, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  notificationChannelAccounts,
  smsTransportPolicies,
  smsTransportPolicyEvents,
} from "./schema.js"
import { NotificationError } from "./service-shared.js"

export async function inspectInboundSmsAccount(
  db: PostgresJsDatabase,
  envelope: InboundSmsEnvelopeV1,
) {
  const rows = await db
    .select()
    .from(notificationChannelAccounts)
    .where(
      and(
        eq(notificationChannelAccounts.id, envelope.channelAccountId),
        eq(notificationChannelAccounts.channel, "sms"),
        eq(notificationChannelAccounts.normalizedAddress, normalizeE164(envelope.receivingAddress)),
        eq(notificationChannelAccounts.inboundSourceId, envelope.sourceId),
      ),
    )
    .limit(2)
  if (rows.length === 0) return { kind: "missing" as const }
  if (rows.length > 1 || rows[0]!.inboundIdentity !== "unambiguous") {
    return { kind: "ambiguous" as const }
  }
  const account = rows[0]!
  if (
    account.lifecycle !== "active" ||
    !account.inboundCapable ||
    account.health === "unavailable"
  ) {
    return { kind: "unavailable" as const }
  }
  return {
    kind: "ready" as const,
    accountId: account.id,
    normalizedAddress: account.normalizedAddress,
  }
}

export async function projectInboundSmsPolicy(
  db: PostgresJsDatabase,
  envelope: InboundSmsEnvelopeV1,
): Promise<void> {
  if (!envelope.policyEvent) return
  const destinationAddress = normalizeE164(envelope.senderAddress)
  const occurredAt = new Date(envelope.occurredAt)
  await db
    .insert(smsTransportPolicyEvents)
    .values({
      id: newId("sms_transport_policy_events"),
      channelAccountId: envelope.channelAccountId,
      destinationAddress,
      sourceId: envelope.sourceId,
      externalMessageId: envelope.externalMessageId,
      kind: envelope.policyEvent,
      adapterHandledResponse: envelope.adapterHandledResponse,
      occurredAt,
    })
    .onConflictDoNothing()
  // Always repair the current projection on replay. The immutable ledger insert
  // may have committed before a prior projection attempt was interrupted.

  const state = envelope.policyEvent === "hard_opt_out" ? "hard_opt_out" : "allowed"
  await db
    .insert(smsTransportPolicies)
    .values({
      id: newId("sms_transport_policies"),
      channelAccountId: envelope.channelAccountId,
      destinationAddress,
      state,
      lastEventOccurredAt: occurredAt,
    })
    .onConflictDoUpdate({
      target: [smsTransportPolicies.channelAccountId, smsTransportPolicies.destinationAddress],
      set: { state, lastEventOccurredAt: occurredAt, updatedAt: new Date() },
      setWhere:
        state === "hard_opt_out"
          ? or(
              lt(smsTransportPolicies.lastEventOccurredAt, occurredAt),
              and(
                eq(smsTransportPolicies.lastEventOccurredAt, occurredAt),
                eq(smsTransportPolicies.state, "allowed"),
              ),
            )
          : lt(smsTransportPolicies.lastEventOccurredAt, occurredAt),
    })
}

export async function assertSmsAdmissionAllowed(
  db: PostgresJsDatabase,
  channelAccountId: string,
  destination: string,
): Promise<void> {
  const [policy] = await db
    .select({ state: smsTransportPolicies.state })
    .from(smsTransportPolicies)
    .where(
      and(
        eq(smsTransportPolicies.channelAccountId, channelAccountId),
        eq(smsTransportPolicies.destinationAddress, normalizeE164(destination)),
      ),
    )
    .limit(1)
  if (policy?.state === "hard_opt_out") {
    throw new NotificationError("SMS destination has a hard opt-out")
  }
}

export async function getOutboundSmsState(
  db: PostgresJsDatabase,
  input: { channelAccountId: string; destinationAddress: string },
) {
  const [account] = await db
    .select()
    .from(notificationChannelAccounts)
    .where(
      and(
        eq(notificationChannelAccounts.id, input.channelAccountId),
        eq(notificationChannelAccounts.channel, "sms"),
      ),
    )
    .limit(1)
  if (!account) return null
  const [policy] = await db
    .select({ state: smsTransportPolicies.state })
    .from(smsTransportPolicies)
    .where(
      and(
        eq(smsTransportPolicies.channelAccountId, account.id),
        eq(smsTransportPolicies.destinationAddress, normalizeE164(input.destinationAddress)),
      ),
    )
    .limit(1)
  return {
    normalizedAddress: account.normalizedAddress,
    health: account.health,
    available:
      account.lifecycle === "active" &&
      account.outboundCapable &&
      account.health !== "unavailable" &&
      account.allowedPurposes.includes("conversation-reply"),
    attachmentsCapable: account.attachmentsCapable,
    suppressed: policy?.state === "hard_opt_out",
  }
}
