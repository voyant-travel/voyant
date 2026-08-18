import { z } from "zod"

export const CHANNEL_ADAPTER_PROTOCOL_VERSION = "channel-adapter.v1" as const
export const channelAdapterProtocolVersionSchema = z.literal(CHANNEL_ADAPTER_PROTOCOL_VERSION)

/**
 * Channel identifiers are deliberately open strings. A host negotiates support
 * from capabilities instead of assuming that today's built-in channels are the
 * complete set.
 */
export const channelKindSchema = z.string().trim().min(1).max(64)

export const channelCapabilitiesSchema = z
  .object({
    channel: channelKindSchema,
    outbound: z.boolean(),
    inbound: z.boolean(),
    lifecycleEvents: z.boolean(),
    policyEvaluation: z.boolean(),
    privateAttachments: z.boolean(),
    accountValidation: z.boolean(),
    health: z.boolean(),
    /** MMS/file transport is negotiated independently for every channel. */
    multimedia: z.boolean(),
  })
  .strict()

export type ChannelCapabilities = z.infer<typeof channelCapabilitiesSchema>
export const channelAdapterCapabilitiesSchema = z
  .array(channelCapabilitiesSchema)
  .min(1)
  .superRefine((channels, context) => {
    const seen = new Set<string>()
    for (const entry of channels) {
      if (seen.has(entry.channel)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate channel capability: ${entry.channel}`,
        })
      }
      seen.add(entry.channel)
    }
  })
export type ChannelAdapterCapabilities = z.infer<typeof channelAdapterCapabilitiesSchema>

export const channelAdapterDescriptorSchema = z
  .object({
    protocolVersion: channelAdapterProtocolVersionSchema,
    adapterId: z.string().trim().min(1).max(128),
    channels: channelAdapterCapabilitiesSchema,
  })
  .strict()

export type ChannelAdapterDescriptor = z.infer<typeof channelAdapterDescriptorSchema>

export const adapterAccountRefSchema = z.string().trim().min(1).max(512)
export const adapterSourceRefSchema = z.string().trim().min(1).max(512)
export const smsPolicyEventSchema = z.enum(["hard_opt_out", "opt_in"]).nullable()
export type SmsPolicyEvent = z.infer<typeof smsPolicyEventSchema>
export const smsTransportMetadataSchema = z
  .object({ policyEvent: smsPolicyEventSchema, adapterHandledResponse: z.boolean() })
  .strict()

const E164_PATTERN = /^\+[1-9]\d{1,14}$/
export function normalizeE164(value: string): string {
  const normalized = value.trim()
  if (!E164_PATTERN.test(normalized)) throw new Error("Address must be strict E.164")
  return normalized
}

export const accountProvisioningInputSchema = z
  .object({
    operationId: z.string().trim().min(1).max(256),
    channel: channelKindSchema,
    address: z.string().trim().min(1).max(2048),
    displayName: z.string().trim().min(1).max(512),
    inbound: z.boolean(),
    outbound: z.boolean(),
  })
  .strict()
export type AccountProvisioningInput = z.infer<typeof accountProvisioningInputSchema>

export const accountProvisioningResultSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    normalizedAddress: z.string().trim().min(1).max(2048),
    displayAddress: z.string().trim().min(1).max(2048),
    inboundSourceRef: adapterSourceRefSchema.nullable(),
  })
  .strict()
export type AccountProvisioningResult = z.infer<typeof accountProvisioningResultSchema>

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
  .superRefine((value, context) => {
    if (value.channel === "sms") {
      try {
        normalizeE164(value.recipient)
      } catch {
        context.addIssue({
          code: "custom",
          path: ["recipient"],
          message: "SMS recipient must be strict E.164",
        })
      }
    }
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

/** Queue references are opaque only inside their account and ingress source scope. */
export const inboundItemRefSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    sourceRef: adapterSourceRefSchema,
    id: z.string().trim().min(1).max(1024),
  })
  .strict()
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
    sourceRef: adapterSourceRefSchema,
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
    sms: smsTransportMetadataSchema.nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.channel !== "sms") {
      if (value.sms !== null)
        context.addIssue({
          code: "custom",
          path: ["sms"],
          message: "SMS metadata is channel-specific",
        })
      return
    }
    try {
      normalizeE164(value.sender.address)
      for (const recipient of value.recipients) normalizeE164(recipient.address)
    } catch {
      context.addIssue({ code: "custom", message: "SMS addresses must be strict E.164" })
    }
  })

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
export const rawQueueAcceptanceSchema = z.discriminatedUnion("accepted", [
  z.object({ accepted: z.literal(true), item: inboundItemRefSchema }).strict(),
  z
    .object({
      accepted: z.literal(false),
      code: z.enum([
        "invalid_authenticity_proof",
        "stale_request",
        "unknown_account",
        "invalid_payload",
      ]),
    })
    .strict(),
])
export type RawQueueAcceptance = z.infer<typeof rawQueueAcceptanceSchema>

export const deliveryLifecycleEventSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    externalEventId: z.string().trim().min(1).max(1024),
    externalSubmissionId: z.string().trim().min(1).max(1024),
    occurredAt: z.string().datetime({ offset: true }),
    state: z.enum([
      "accepted",
      "delivered",
      "failed",
      "bounced",
      "complained",
      "suppressed",
      "cancelled",
    ]),
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

export const lifecycleItemRefSchema = z
  .object({
    adapterAccountRef: adapterAccountRefSchema,
    sourceRef: adapterSourceRefSchema,
    id: z.string().trim().min(1).max(1024),
  })
  .strict()
export type LifecycleItemRef = z.infer<typeof lifecycleItemRefSchema>
export const lifecycleListPageSchema = z
  .object({
    items: z.array(lifecycleItemRefSchema),
    cursor: z.string().min(1).max(4096).nullable(),
  })
  .strict()
export type LifecycleListPage = z.infer<typeof lifecycleListPageSchema>

/** 3GPP concatenation boundaries: 160/153 septets for GSM-7, 70/67 units for UCS-2. */
export function smsSegmentCount(text: string): { encoding: "gsm7" | "ucs2"; segments: number } {
  if (text.length === 0) return { encoding: "gsm7", segments: 0 }
  const gsmBasic = new Set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  )
  const gsmExtension = new Set("\f^{}\\[~]|€")
  let septets = 0
  let gsm7 = true
  for (const character of text) {
    if (gsmBasic.has(character)) septets += 1
    else if (gsmExtension.has(character)) septets += 2
    else {
      gsm7 = false
      break
    }
  }
  const units = gsm7 ? septets : text.length
  const single = gsm7 ? 160 : 70
  const concatenated = gsm7 ? 153 : 67
  return {
    encoding: gsm7 ? "gsm7" : "ucs2",
    segments: units <= single ? 1 : Math.ceil(units / concatenated),
  }
}

export interface ChannelAdapterV1 {
  readonly descriptor: ChannelAdapterDescriptor
  provisionAccount?(input: AccountProvisioningInput): Promise<AccountProvisioningResult>
  validateAccount?(input: AccountValidationInput): Promise<AccountValidationResult>
  getHealth?(input: { adapterAccountRef: string }): Promise<AdapterHealth>
  submitOutbound?(message: OutboundMessage): Promise<OutboundAcceptance>
  listInbound?(input: {
    adapterAccountRef: string
    sourceRef: string
    cursor?: string
    limit: number
  }): Promise<InboundListPage>
  fetchInbound?(ref: InboundItemRef): Promise<InboundEnvelope>
  ackInbound?(ref: InboundItemRef): Promise<void>
  verifyInboundAuthenticity?(
    request: InboundAuthenticityRequest,
  ): Promise<InboundAuthenticityResult>
  /** Atomically verifies the untouched request bytes before making an item listable. */
  queueVerifiedInbound?(request: InboundAuthenticityRequest): Promise<RawQueueAcceptance>
  verifyLifecycleAuthenticity?(
    request: LifecycleNormalizationInput,
  ): Promise<InboundAuthenticityResult>
  /** Lifecycle counterpart to queueVerifiedInbound; invalid raw bytes never enter the queue. */
  queueVerifiedLifecycle?(request: LifecycleNormalizationInput): Promise<{ accepted: boolean }>
  normalizeLifecycleEvents?(
    input: LifecycleNormalizationInput,
  ): Promise<readonly DeliveryLifecycleEvent[]>
  listLifecycle?(input: {
    adapterAccountRef: string
    sourceRef: string
    cursor?: string
    limit: number
  }): Promise<LifecycleListPage>
  fetchLifecycle?(ref: LifecycleItemRef): Promise<DeliveryLifecycleEvent>
  ackLifecycle?(ref: LifecycleItemRef): Promise<void>
  evaluatePolicy?(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult>
  readPrivateAttachment?(input: {
    adapterAccountRef: string
    sourceRef: string
    handle: string
  }): Promise<AsyncIterable<Uint8Array>>
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
  inbound: [
    "listInbound",
    "fetchInbound",
    "ackInbound",
    "verifyInboundAuthenticity",
    "queueVerifiedInbound",
  ],
  lifecycleEvents: [
    "verifyLifecycleAuthenticity",
    "queueVerifiedLifecycle",
    "normalizeLifecycleEvents",
    "listLifecycle",
    "fetchLifecycle",
    "ackLifecycle",
  ],
  policyEvaluation: ["evaluatePolicy"],
  privateAttachments: ["readPrivateAttachment"],
  accountValidation: ["provisionAccount", "validateAccount"],
  health: ["getHealth"],
} as const

export function validateChannelAdapter(adapter: ChannelAdapterV1): ChannelAdapterDescriptor {
  const candidate = z
    .object({ protocolVersion: z.string(), adapterId: z.string(), channels: z.unknown() })
    .passthrough()
    .parse(adapter.descriptor)
  if (candidate.protocolVersion !== CHANNEL_ADAPTER_PROTOCOL_VERSION) {
    throw new ChannelAdapterCompatibilityError(
      "unsupported_protocol",
      "Adapter protocol is not supported",
    )
  }
  const descriptor = channelAdapterDescriptorSchema.parse(adapter.descriptor)
  for (const [capability, methods] of Object.entries(capabilityMethods)) {
    const enabled = descriptor.channels.some(
      (channel) => channel[capability as keyof typeof capabilityMethods],
    )
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
    capabilities: readonly (keyof Omit<ChannelCapabilities, "channel">)[]
  },
): ChannelAdapterDescriptor {
  const descriptor = validateChannelAdapter(adapter)
  if (descriptor.protocolVersion !== requirements.protocolVersion) {
    throw new ChannelAdapterCompatibilityError(
      "unsupported_protocol",
      "Adapter protocol is not supported",
    )
  }
  const channel = descriptor.channels.find(({ channel }) => channel === requirements.channel)
  if (!channel) {
    throw new ChannelAdapterCompatibilityError(
      "channel_not_supported",
      "Required channel is not supported",
    )
  }
  for (const capability of requirements.capabilities) {
    if (!channel[capability]) {
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
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Canonical adapter payload requires plain JSON objects")
    }
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalAdapterPayload(entry)}`)
      .join(",")}}`
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Canonical adapter payload requires finite JSON numbers")
  }
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    throw new Error("Canonical adapter payload must be JSON-compatible")
  }
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error("Canonical adapter payload must be JSON-compatible")
  return serialized
}

/** Canonicalize the schema-normalized value, never caller-owned pre-parse JSON. */
export function canonicalSchemaPayload<T>(schema: z.ZodType<T>, value: unknown): string {
  return canonicalAdapterPayload(schema.parse(value))
}
