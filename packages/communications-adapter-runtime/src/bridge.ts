import {
  accountProvisioningResultSchema,
  accountValidationResultSchema,
  adapterHealthSchema,
  type ChannelAdapterV1,
  type InboundItemRef,
  inboundEnvelopeSchema,
  type LifecycleItemRef,
  normalizeE164,
  outboundAcceptanceSchema,
  outboundMessageSchema,
  validateChannelAdapter,
} from "@voyant-travel/channel-adapter-contracts"
import type {
  ConversationIngressSource,
  InboundConversationEnvelopeV1,
} from "@voyant-travel/conversations-contracts"
import type { NotificationDeliveryLifecycleSource } from "@voyant-travel/notifications/delivery-lifecycle-source-port"
import type { DurableNotificationProviderRuntime } from "@voyant-travel/notifications/durable-provider-port"
import type { NotificationProvider } from "@voyant-travel/notifications/types"
import {
  assertCommunicationsAdapterBundle,
  type CommunicationsAdapterAccountBinding,
  type CommunicationsAdapterBundle,
} from "./runtime-port.js"

function required<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined) throw new Error(`Channel adapter is missing ${name}`)
  return value
}

export function createCommunicationsAdapterBridge(bundle: CommunicationsAdapterBundle): {
  durableRuntime: DurableNotificationProviderRuntime
  ingressSource: ConversationIngressSource
  lifecycleSource: NotificationDeliveryLifecycleSource
} {
  assertCommunicationsAdapterBundle(bundle)
  const accounts = bundle.accounts.map((account) => ({ ...account }))
  return {
    durableRuntime: createDurableRuntime(bundle, accounts),
    ingressSource: createIngressSource(bundle, accounts),
    lifecycleSource: createLifecycleSource(bundle.adapter, accounts),
  }
}

function createProvider(
  adapter: ChannelAdapterV1,
  accounts: CommunicationsAdapterAccountBinding[],
): NotificationProvider {
  const descriptor = validateChannelAdapter(adapter)
  const knownAccounts = new Set(accounts.map(({ adapterAccountRef }) => adapterAccountRef))
  return {
    name: descriptor.adapterId,
    channels: descriptor.channels.filter(({ outbound }) => outbound).map(({ channel }) => channel),
    durableDelivery: {
      protocol: "notification-provider-idempotency-v1",
      async send(payload, context) {
        const binding = accounts.find(
          ({ address, channel, outbound }) =>
            outbound && channel === payload.channel && address === payload.from,
        )
        if (!binding) throw new Error(`No outbound ${payload.channel} account matches its sender`)
        const policy = await required(adapter.evaluatePolicy, "evaluatePolicy").call(adapter, {
          adapterAccountRef: binding.adapterAccountRef,
          channel: payload.channel,
          recipient: payload.channel === "sms" ? normalizeE164(payload.to) : payload.to,
          purpose: toPolicyPurpose(payload.purpose),
        })
        if (!policy.allowed) {
          throw new Error(`Channel adapter policy rejected delivery: ${policy.code}`)
        }
        const health = adapterHealthSchema.parse(
          await required(adapter.getHealth, "getHealth").call(adapter, {
            adapterAccountRef: binding.adapterAccountRef,
          }),
        )
        if (health.status === "unavailable")
          throw new Error("Channel adapter account is unavailable")
        const channel = descriptor.channels.find(({ channel }) => channel === payload.channel)!
        if (
          (payload.attachments?.length ?? 0) > 0 &&
          (!channel.multimedia || !channel.privateAttachments)
        ) {
          throw new Error(`Attachments are not negotiated for ${payload.channel}`)
        }
        const message = outboundMessageSchema.parse({
          operationId: context.idempotencyKey,
          adapterAccountRef: binding.adapterAccountRef,
          channel: payload.channel,
          recipient: payload.channel === "sms" ? normalizeE164(payload.to) : payload.to,
          subject: payload.subject ?? null,
          text: payload.text ?? null,
          sanitizedHtml: payload.html ?? null,
          attachments: (payload.attachments ?? []).map((attachment) => ({
            handle: required(attachment.privateHandle, "private attachment handle"),
            filename: attachment.filename,
            contentType: attachment.contentType ?? "application/octet-stream",
            size: 0,
          })),
          threadRef: null,
          metadata: {},
        })
        const accepted = outboundAcceptanceSchema.parse(
          await required(adapter.submitOutbound, "submitOutbound").call(adapter, message),
        )
        return { id: accepted.externalSubmissionId, provider: descriptor.adapterId }
      },
    },
    channelAccounts: {
      protocol: "notification-channel-account-v1",
      matches(adapterRef) {
        return knownAccounts.has(adapterRef)
      },
      async provision(draft) {
        if (!draft.inboundCapable || !draft.outboundCapable) {
          throw new Error("Selected Inbox Channel Account must be provisioned two-way")
        }
        const channelCapabilities = descriptor.channels.find(
          ({ channel }) => channel === draft.channel,
        )
        if (
          !channelCapabilities?.inbound ||
          !channelCapabilities.outbound ||
          !channelCapabilities.lifecycleEvents ||
          !channelCapabilities.policyEvaluation ||
          !channelCapabilities.accountValidation ||
          !channelCapabilities.health
        ) {
          throw new Error(`Two-way ${draft.channel} setup is incomplete`)
        }
        const result = accountProvisioningResultSchema.parse(
          await required(adapter.provisionAccount, "provisionAccount").call(adapter, {
            operationId: `provision:${draft.channel}:${draft.address}`.slice(0, 256),
            channel: draft.channel,
            address: draft.channel === "sms" ? normalizeE164(draft.address) : draft.address,
            displayName: draft.displayName,
            inbound: draft.inboundCapable ?? false,
            outbound: draft.outboundCapable ?? true,
          }),
        )
        const binding: CommunicationsAdapterAccountBinding = {
          adapterAccountRef: result.adapterAccountRef,
          sourceRef: result.inboundSourceRef ?? `outbound:${result.adapterAccountRef}`,
          channel: draft.channel === "sms" ? "sms" : "email",
          address: result.normalizedAddress,
          inbound: draft.inboundCapable ?? false,
          outbound: draft.outboundCapable ?? true,
        }
        const existing = accounts.findIndex(
          ({ adapterAccountRef }) => adapterAccountRef === result.adapterAccountRef,
        )
        if (existing === -1) accounts.push(binding)
        else accounts[existing] = { ...accounts[existing], ...binding }
        knownAccounts.add(result.adapterAccountRef)
        return {
          adapterRef: result.adapterAccountRef,
          normalizedAddress: result.normalizedAddress,
          displayAddress: result.displayAddress,
        }
      },
      async validate(adapterRef) {
        const binding = accounts.find(({ adapterAccountRef }) => adapterAccountRef === adapterRef)
        if (!binding) throw new Error("Channel adapter account is not bound")
        const validation = accountValidationResultSchema.parse(
          await required(adapter.validateAccount, "validateAccount").call(adapter, {
            adapterAccountRef: adapterRef,
            requiredChannels: [binding.channel],
            requiredCapabilities: [
              "health",
              "inbound",
              "outbound",
              "lifecycleEvents",
              "policyEvaluation",
            ],
          }),
        )
        if (!validation.valid)
          throw new Error(`Channel adapter account validation failed: ${validation.code}`)
        const health = adapterHealthSchema.parse(
          await required(adapter.getHealth, "getHealth").call(adapter, {
            adapterAccountRef: validation.normalizedAccountRef,
          }),
        )
        return {
          health: health.status,
          inboundCapable: binding?.inbound ?? false,
          outboundCapable: binding?.outbound ?? false,
          inboundIdentity: binding?.inbound ? "unambiguous" : undefined,
          inboundSourceId: binding.inbound ? `${descriptor.adapterId}:inbound` : undefined,
          attachmentsCapable:
            descriptor.channels.find(({ channel }) => channel === binding?.channel)?.multimedia ??
            false,
        }
      },
      activate({ channelAccountId, adapterRef }) {
        const binding = accounts.find((account) => account.adapterAccountRef === adapterRef)
        if (!binding) throw new Error("Cannot activate an unbound Channel Account")
        binding.channelAccountId = channelAccountId
      },
    },
  }
}

function toPolicyPurpose(
  purpose: string | undefined,
): "transactional" | "conversation" | "marketing" {
  if (purpose?.toLowerCase().includes("marketing")) return "marketing"
  if (purpose?.toLowerCase().includes("conversation")) return "conversation"
  return "transactional"
}

function createDurableRuntime(
  bundle: CommunicationsAdapterBundle,
  accounts: CommunicationsAdapterAccountBinding[],
): DurableNotificationProviderRuntime {
  return {
    providers: [createProvider(bundle.adapter, accounts)],
    async createIsolatedProbe() {
      const probe = await bundle.createIsolatedProbe()
      let adapter = probe.adapter
      return {
        get providers() {
          return [
            createProvider(
              adapter,
              accounts.map((account) => ({ ...account })),
            ),
          ]
        },
        async restart() {
          adapter = await probe.restart()
          return [
            createProvider(
              adapter,
              accounts.map((account) => ({ ...account })),
            ),
          ]
        },
        acceptedCount(_providerName, key) {
          return probe.acceptedCount(key)
        },
      }
    },
  }
}

function assertRef(
  accounts: readonly CommunicationsAdapterAccountBinding[],
  ref: InboundItemRef | LifecycleItemRef,
) {
  if (
    !accounts.some(
      (account) =>
        account.adapterAccountRef === ref.adapterAccountRef && account.sourceRef === ref.sourceRef,
    )
  ) {
    throw new Error("Adapter item reference escaped its account/source scope")
  }
}

function createIngressSource(
  bundle: CommunicationsAdapterBundle,
  accounts: CommunicationsAdapterAccountBinding[],
): ConversationIngressSource {
  const adapter = bundle.adapter
  const descriptor = validateChannelAdapter(adapter)
  const inbound = () => accounts.filter(({ inbound }) => inbound)
  const pendingAttachments = new Map<
    string,
    { adapterAccountRef: string; sourceRef: string; handle: string }
  >()
  const pendingByInboundRef = new Map<string, string[]>()
  let attachmentSequence = 0
  const refKey = (ref: InboundItemRef) =>
    `${ref.adapterAccountRef}\u0000${ref.sourceRef}\u0000${ref.id}`
  const clearPending = (key: string) => {
    for (const token of pendingByInboundRef.get(key) ?? []) pendingAttachments.delete(token)
    pendingByInboundRef.delete(key)
  }
  return {
    id: `${descriptor.adapterId}:inbound`,
    async list({ limit }) {
      const items: InboundItemRef[] = []
      for (const account of inbound()) {
        const health = adapterHealthSchema.parse(
          await required(adapter.getHealth, "getHealth").call(adapter, {
            adapterAccountRef: account.adapterAccountRef,
          }),
        )
        if (health.status === "unavailable") continue
        const page = await required(adapter.listInbound, "listInbound").call(adapter, {
          adapterAccountRef: account.adapterAccountRef,
          sourceRef: account.sourceRef,
          limit: limit - items.length,
        })
        items.push(...page.items)
        if (items.length >= limit) break
      }
      return { items, cursor: undefined }
    },
    async fetch(ref) {
      const scoped = ref as InboundItemRef
      assertRef(inbound(), scoped)
      const key = refKey(scoped)
      clearPending(key)
      let envelope: ReturnType<typeof inboundEnvelopeSchema.parse>
      try {
        envelope = inboundEnvelopeSchema.parse(
          await required(adapter.fetchInbound, "fetchInbound").call(adapter, scoped),
        )
      } catch (error) {
        clearPending(key)
        throw error
      }
      if (
        envelope.adapterAccountRef !== scoped.adapterAccountRef ||
        envelope.sourceRef !== scoped.sourceRef
      )
        throw new Error("Inbound payload scope drift")
      const binding = inbound().find(
        ({ adapterAccountRef, sourceRef }) =>
          adapterAccountRef === scoped.adapterAccountRef && sourceRef === scoped.sourceRef,
      )!
      return toConversationEnvelope(
        `${descriptor.adapterId}:inbound`,
        binding,
        envelope,
        (attachment) => {
          const token = `${descriptor.adapterId}:pending-attachment:${++attachmentSequence}`
          pendingAttachments.set(token, {
            adapterAccountRef: envelope.adapterAccountRef,
            sourceRef: envelope.sourceRef,
            handle: attachment.handle,
          })
          const tokens = pendingByInboundRef.get(key) ?? []
          tokens.push(token)
          pendingByInboundRef.set(key, tokens)
          return token
        },
      )
    },
    async ack(ref) {
      const scoped = ref as InboundItemRef
      assertRef(inbound(), scoped)
      try {
        await required(adapter.ackInbound, "ackInbound").call(adapter, scoped)
      } finally {
        clearPending(refKey(scoped))
      }
    },
    async importInboundAttachment(input) {
      const scoped = pendingAttachments.get(input.privateHandle)
      if (!scoped) throw new Error("Inbound attachment handle is not pending for this source")
      const bytes = await required(adapter.readPrivateAttachment, "readPrivateAttachment").call(
        adapter,
        scoped,
      )
      const imported = await required(
        bundle.importInboundAttachment,
        "importInboundAttachment",
      )({ ...input, bytes })
      pendingAttachments.delete(input.privateHandle)
      return imported
    },
  }
}

function toConversationEnvelope(
  sourceId: string,
  binding: CommunicationsAdapterAccountBinding,
  envelope: ReturnType<typeof inboundEnvelopeSchema.parse>,
  attachmentHandle: (attachment: (typeof envelope.attachments)[number]) => string,
): InboundConversationEnvelopeV1 {
  const attachments = envelope.attachments.map((attachment) => ({
    externalId: attachment.handle,
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
    privateHandle: attachmentHandle(attachment),
  }))
  if (envelope.channel === "sms")
    return {
      version: "1",
      channel: "sms",
      sourceId,
      externalEnvelopeId: envelope.externalEnvelopeId,
      externalMessageId: envelope.externalMessageId,
      channelAccountId: required(binding.channelAccountId, "SMS Channel Account id"),
      receivingAddress: normalizeE164(envelope.recipients[0]!.address),
      senderAddress: normalizeE164(envelope.sender.address),
      text: required(envelope.text, "SMS text"),
      attachments,
      policyEvent: envelope.sms?.policyEvent ?? null,
      adapterHandledResponse: envelope.sms?.adapterHandledResponse ?? false,
      occurredAt: envelope.occurredAt,
    }
  return {
    version: "1",
    sourceId,
    externalEnvelopeId: envelope.externalEnvelopeId,
    externalMessageId: envelope.externalMessageId,
    sender: { address: envelope.sender.address, name: envelope.sender.displayName },
    to: envelope.recipients.map(({ address, displayName }) => ({ address, name: displayName })),
    cc: [],
    replyTo: [],
    subject: envelope.subject,
    text: envelope.text,
    html: envelope.untrustedHtml,
    attachments,
    classification: envelope.classification,
    threading: {
      messageId: envelope.externalMessageId,
      inReplyTo: envelope.replyToExternalMessageId,
      references: envelope.threadRef ? [envelope.threadRef] : [],
    },
    occurredAt: envelope.occurredAt,
  }
}

function createLifecycleSource(
  adapter: ChannelAdapterV1,
  bindings: CommunicationsAdapterAccountBinding[],
): NotificationDeliveryLifecycleSource {
  const accounts = () => bindings.filter(({ outbound }) => outbound)
  return {
    id: `${validateChannelAdapter(adapter).adapterId}:lifecycle`,
    async list({ limit }) {
      const items: LifecycleItemRef[] = []
      for (const account of accounts()) {
        const health = adapterHealthSchema.parse(
          await required(adapter.getHealth, "getHealth").call(adapter, {
            adapterAccountRef: account.adapterAccountRef,
          }),
        )
        if (health.status === "unavailable") continue
        const page = await required(adapter.listLifecycle, "listLifecycle").call(adapter, {
          adapterAccountRef: account.adapterAccountRef,
          sourceRef: account.sourceRef,
          limit: limit - items.length,
        })
        items.push(...page.items)
        if (items.length >= limit) break
      }
      return { items, cursor: null }
    },
    async fetch(ref) {
      assertRef(accounts(), ref)
      return required(adapter.fetchLifecycle, "fetchLifecycle").call(adapter, ref)
    },
    async ack(ref) {
      assertRef(accounts(), ref)
      await required(adapter.ackLifecycle, "ackLifecycle").call(adapter, ref)
    },
  }
}
