import { z } from "zod"

export const CHANNEL_ADAPTER_PROTOCOL_VERSION = "channel-adapter.v1" as const
export const channelAdapterProtocolVersionSchema = z.literal(CHANNEL_ADAPTER_PROTOCOL_VERSION)

/**
 * Channel identifiers are deliberately open strings. A host negotiates support
 * from capabilities instead of assuming that today's built-in channels are the
 * complete set.
 */
export const channelKindSchema = z.string().trim().min(1).max(64)

export const channelAdapterCapabilitiesSchema = z
  .object({
    channels: z.array(channelKindSchema).min(1),
    outbound: z.boolean(),
    inbound: z.boolean(),
    lifecycleEvents: z.boolean(),
    policyEvaluation: z.boolean(),
    privateAttachments: z.boolean(),
    accountValidation: z.boolean(),
    health: z.boolean(),
  })
  .strict()

export type ChannelAdapterCapabilities = z.infer<typeof channelAdapterCapabilitiesSchema>

export const channelAdapterDescriptorSchema = z
  .object({
    protocolVersion: channelAdapterProtocolVersionSchema,
    adapterId: z.string().trim().min(1).max(128),
    capabilities: channelAdapterCapabilitiesSchema,
  })
  .strict()

export type ChannelAdapterDescriptor = z.infer<typeof channelAdapterDescriptorSchema>

export const adapterAccountRefSchema = z.string().trim().min(1).max(512)

export const accountValidationInputSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    requiredChannels: z.array(channelKindSchema).min(1),
    requiredCapabilities: z
      .array(
        z.enum([
          "outbound",
          "inbound",
          "lifecycleEvents",
          "policyEvaluation",
          "privateAttachments",
          "health",
        ]),
      )
      .default([]),
  })
  .strict()

export type AccountValidationInput = z.infer<typeof accountValidationInputSchema>

export const accountValidationResultSchema = z.discriminatedUnion("valid", [
  z.object({ valid: z.literal(true), normalizedAccountRef: adapterAccountRefSchema }).strict(),
  z
    .object({
      valid: z.literal(false),
      code: z.enum(["not_found", "disabled", "missing_capability", "invalid_account"]),
    })
    .strict(),
])

export type AccountValidationResult = z.infer<typeof accountValidationResultSchema>

export const adapterHealthSchema = z
  .object({
    status: z.enum(["healthy", "degraded", "unavailable"]),
    checkedAt: z.string().datetime({ offset: true }),
    reasonCode: z.string().trim().min(1).max(128).nullable(),
  })
  .strict()

export type AdapterHealth = z.infer<typeof adapterHealthSchema>

export const privateAttachmentHandleSchema = z
  .object({
    handle: z.string().trim().min(1).max(1024),
    filename: z.string().trim().min(1).max(512),
    contentType: z.string().trim().min(1).max(255),
    size: z.number().int().nonnegative(),
  })
  .strict()

export type PrivateAttachmentHandle = z.infer<typeof privateAttachmentHandleSchema>

export const outboundMessageSchema = z
  .object({
    operationId: z.string().trim().min(1).max(256),
    adapterAccountRef: adapterAccountRefSchema,
    channel: channelKindSchema,
    recipient: z.string().trim().min(1).max(2048),
    subject: z.string().max(998).nullable(),
    text: z.string().max(1_000_000).nullable(),
    sanitizedHtml: z.string().max(2_000_000).nullable(),
    attachments: z.array(privateAttachmentHandleSchema).max(100),
    threadRef: z.string().trim().min(1).max(1024).nullable(),
    metadata: z.record(z.string(), z.string().max(2048)).default({}),
  })
  .strict()
  .refine((value) => value.text !== null || value.sanitizedHtml !== null, {
    message: "A message must have text or sanitizedHtml content",
  })

export type OutboundMessage = z.infer<typeof outboundMessageSchema>

export const outboundAcceptanceSchema = z
  .object({
    state: z.literal("accepted"),
    externalSubmissionId: z.string().trim().min(1).max(1024),
    acceptedAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type OutboundAcceptance = z.infer<typeof outboundAcceptanceSchema>

export const inboundItemRefSchema = z.object({ id: z.string().trim().min(1).max(1024) }).strict()
export type InboundItemRef = z.infer<typeof inboundItemRefSchema>

export const inboundListPageSchema = z
  .object({
    items: z.array(inboundItemRefSchema),
    cursor: z.string().min(1).max(4096).nullable(),
  })
  .strict()
export type InboundListPage = z.infer<typeof inboundListPageSchema>

export const normalizedAddressSchema = z
  .object({
    address: z.string().trim().min(1).max(2048),
    displayName: z.string().max(512).nullable(),
  })
  .strict()

export const inboundEnvelopeSchema = z
  .object({
    protocolVersion: channelAdapterProtocolVersionSchema,
    adapterAccountRef: adapterAccountRefSchema,
    channel: channelKindSchema,
    externalEnvelopeId: z.string().trim().min(1).max(1024),
    externalMessageId: z.string().trim().min(1).max(1024),
    occurredAt: z.string().datetime({ offset: true }),
    sender: normalizedAddressSchema,
    recipients: z.array(normalizedAddressSchema).min(1),
    subject: z.string().max(998).nullable(),
    text: z.string().max(1_000_000).nullable(),
    untrustedHtml: z.string().max(2_000_000).nullable(),
    attachments: z.array(privateAttachmentHandleSchema).max(100),
    threadRef: z.string().trim().min(1).max(1024).nullable(),
    replyToExternalMessageId: z.string().trim().min(1).max(1024).nullable(),
    classification: z.enum(["message", "automatic_reply", "delivery_status", "complaint"]),
  })
  .strict()

export type InboundEnvelope = z.infer<typeof inboundEnvelopeSchema>

export const inboundAuthenticityRequestSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    headers: z.record(z.string(), z.string()),
    body: z.instanceof(Uint8Array),
  })
  .strict()

export type InboundAuthenticityRequest = z.infer<typeof inboundAuthenticityRequestSchema>

export const inboundAuthenticityResultSchema = z.discriminatedUnion("authentic", [
  z.object({ authentic: z.literal(true) }).strict(),
  z
    .object({
      authentic: z.literal(false),
      code: z.enum(["invalid_authenticity_proof", "stale_request", "unknown_account"]),
    })
    .strict(),
])

export type InboundAuthenticityResult = z.infer<typeof inboundAuthenticityResultSchema>

export const deliveryLifecycleEventSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    externalEventId: z.string().trim().min(1).max(1024),
    externalSubmissionId: z.string().trim().min(1).max(1024),
    occurredAt: z.string().datetime({ offset: true }),
    state: z.enum(["accepted", "delivered", "failed", "bounced", "complained", "suppressed"]),
    reasonCode: z.string().trim().min(1).max(128).nullable(),
  })
  .strict()

export type DeliveryLifecycleEvent = z.infer<typeof deliveryLifecycleEventSchema>

export const policyEvaluationInputSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    channel: channelKindSchema,
    recipient: z.string().trim().min(1).max(2048),
    purpose: z.enum(["transactional", "conversation", "marketing"]),
  })
  .strict()

export const policyEvaluationResultSchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(true) }).strict(),
  z
    .object({
      allowed: z.literal(false),
      code: z.enum([
        "recipient_suppressed",
        "consent_required",
        "account_policy",
        "channel_policy",
      ]),
    })
    .strict(),
])

export type PolicyEvaluationInput = z.infer<typeof policyEvaluationInputSchema>
export type PolicyEvaluationResult = z.infer<typeof policyEvaluationResultSchema>

export const lifecycleNormalizationInputSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    headers: z.record(z.string(), z.string()),
    body: z.instanceof(Uint8Array),
  })
  .strict()

export type LifecycleNormalizationInput = z.infer<typeof lifecycleNormalizationInputSchema>

export interface ChannelAdapterV1 {
  readonly descriptor: ChannelAdapterDescriptor
  validateAccount?(input: AccountValidationInput): Promise<AccountValidationResult>
  getHealth?(input: { adapterAccountRef: string }): Promise<AdapterHealth>
  submitOutbound?(message: OutboundMessage): Promise<OutboundAcceptance>
  listInbound?(input: {
    adapterAccountRef: string
    cursor?: string
    limit: number
  }): Promise<InboundListPage>
  fetchInbound?(ref: InboundItemRef): Promise<InboundEnvelope>
  ackInbound?(ref: InboundItemRef): Promise<void>
  verifyInboundAuthenticity?(
    request: InboundAuthenticityRequest,
  ): Promise<InboundAuthenticityResult>
  verifyLifecycleAuthenticity?(
    request: LifecycleNormalizationInput,
  ): Promise<InboundAuthenticityResult>
  normalizeLifecycleEvents?(
    input: LifecycleNormalizationInput,
  ): Promise<readonly DeliveryLifecycleEvent[]>
  evaluatePolicy?(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult>
  readPrivateAttachment?(handle: string): Promise<AsyncIterable<Uint8Array>>
}

export class ChannelAdapterCompatibilityError extends Error {
  constructor(
    readonly code: "unsupported_protocol" | "missing_capability" | "channel_not_supported",
    message: string,
  ) {
    super(message)
    this.name = "ChannelAdapterCompatibilityError"
  }
}

const capabilityMethods = {
  outbound: ["submitOutbound"],
  inbound: ["listInbound", "fetchInbound", "ackInbound", "verifyInboundAuthenticity"],
  lifecycleEvents: ["verifyLifecycleAuthenticity", "normalizeLifecycleEvents"],
  policyEvaluation: ["evaluatePolicy"],
  privateAttachments: ["readPrivateAttachment"],
  accountValidation: ["validateAccount"],
  health: ["getHealth"],
} as const

export function validateChannelAdapter(adapter: ChannelAdapterV1): ChannelAdapterDescriptor {
  if (adapter.descriptor.protocolVersion !== CHANNEL_ADAPTER_PROTOCOL_VERSION) {
    throw new ChannelAdapterCompatibilityError(
      "unsupported_protocol",
      "Adapter protocol is not supported",
    )
  }
  const descriptor = channelAdapterDescriptorSchema.parse(adapter.descriptor)
  for (const [capability, methods] of Object.entries(capabilityMethods)) {
    const enabled = descriptor.capabilities[capability as keyof typeof capabilityMethods]
    for (const method of methods) {
      const implemented = typeof adapter[method as keyof ChannelAdapterV1] === "function"
      if (enabled !== implemented) {
        throw new ChannelAdapterCompatibilityError(
          "missing_capability",
          `${capability} capability must exactly match its method surface`,
        )
      }
    }
  }
  return descriptor
}

export function negotiateChannelAdapter(
  adapter: ChannelAdapterV1,
  requirements: {
    protocolVersion: typeof CHANNEL_ADAPTER_PROTOCOL_VERSION
    channel: string
    capabilities: readonly (keyof Omit<ChannelAdapterCapabilities, "channels">)[]
  },
): ChannelAdapterDescriptor {
  const descriptor = validateChannelAdapter(adapter)
  if (descriptor.protocolVersion !== requirements.protocolVersion) {
    throw new ChannelAdapterCompatibilityError(
      "unsupported_protocol",
      "Adapter protocol is not supported",
    )
  }
  if (!descriptor.capabilities.channels.includes(requirements.channel)) {
    throw new ChannelAdapterCompatibilityError(
      "channel_not_supported",
      "Required channel is not supported",
    )
  }
  for (const capability of requirements.capabilities) {
    if (!descriptor.capabilities[capability]) {
      throw new ChannelAdapterCompatibilityError(
        "missing_capability",
        `Required capability is missing: ${capability}`,
      )
    }
  }
  return descriptor
}

export function canonicalAdapterPayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalAdapterPayload).join(",")}]`
  if (value instanceof Uint8Array) return JSON.stringify(Array.from(value))
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalAdapterPayload(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}
