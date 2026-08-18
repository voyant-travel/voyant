import type { ChannelAdapterConformanceControl } from "./conformance.js"
import {
  type AdapterHealth,
  CHANNEL_ADAPTER_PROTOCOL_VERSION,
  type ChannelAdapterCapabilities,
  type ChannelAdapterDescriptor,
  type ChannelAdapterV1,
  canonicalAdapterPayload,
  type DeliveryLifecycleEvent,
  deliveryLifecycleEventSchema,
  type InboundEnvelope,
  type InboundItemRef,
  inboundEnvelopeSchema,
  type OutboundAcceptance,
  type OutboundMessage,
} from "./contracts.js"

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const completeCapabilities: ChannelAdapterCapabilities[number] = {
  channel: "email",
  outbound: true,
  inbound: true,
  lifecycleEvents: true,
  policyEvaluation: true,
  privateAttachments: true,
  accountValidation: true,
  health: true,
  multimedia: true,
}

/** A deterministic, non-networked adapter for contract and host integration tests. */
export class FixtureChannelAdapter implements ChannelAdapterV1 {
  readonly descriptor: ChannelAdapterDescriptor
  readonly #accountRef: string
  readonly #sourceRef: string
  readonly #inbound = new Map<string, InboundEnvelope>()
  readonly #submissions = new Map<string, { fingerprint: string; acceptance: OutboundAcceptance }>()
  readonly #attachments = new Map<string, Uint8Array>()
  readonly #provisions = new Map<
    string,
    { fingerprint: string; result: import("./contracts.js").AccountProvisioningResult }
  >()
  readonly #lifecycle = new Map<string, DeliveryLifecycleEvent>()
  #authentic = true
  #health: AdapterHealth["status"] = "healthy"
  #recipientSuppressed = false

  constructor(input?: {
    adapterId?: string
    accountRef?: string
    sourceRef?: string
    channel?: "email" | "sms"
  }) {
    const channel = input?.channel ?? "email"
    this.#accountRef = input?.accountRef ?? `${channel}-fixture-account`
    this.#sourceRef = input?.sourceRef ?? `${channel}-fixture-source`
    this.descriptor = {
      protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
      adapterId: input?.adapterId ?? "fixture-channel-adapter",
      channels: [{ ...completeCapabilities, channel }],
    }
  }

  async provisionAccount(input: import("./contracts.js").AccountProvisioningInput) {
    const fingerprint = canonicalAdapterPayload(input)
    const existing = this.#provisions.get(input.operationId)
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error("Account provision payload drift")
      return existing.result
    }
    const result = {
      adapterAccountRef: this.#accountRef,
      normalizedAddress: input.address,
      displayAddress: input.address,
      inboundSourceRef: input.inbound ? this.#sourceRef : null,
    }
    this.#provisions.set(input.operationId, { fingerprint, result })
    return result
  }

  async validateAccount(input: {
    adapterAccountRef: string
    requiredChannels: string[]
    requiredCapabilities: (
      | "outbound"
      | "inbound"
      | "lifecycleEvents"
      | "policyEvaluation"
      | "privateAttachments"
      | "health"
    )[]
  }) {
    if (input.adapterAccountRef !== this.#accountRef) {
      return { valid: false as const, code: "not_found" as const }
    }
    if (
      input.requiredChannels.some(
        (channel) => !this.descriptor.channels.some((entry) => entry.channel === channel),
      )
    ) {
      return {
        valid: false as const,
        code: "missing_capability" as const,
      }
    }
    if (
      input.requiredCapabilities.some(
        (capability) => !this.descriptor.channels.some((entry) => entry[capability]),
      )
    ) {
      return {
        valid: false as const,
        code: "missing_capability" as const,
      }
    }
    return { valid: true as const, normalizedAccountRef: this.#accountRef }
  }

  async getHealth(): Promise<AdapterHealth> {
    return {
      status: this.#health,
      checkedAt: "2026-01-01T00:00:00.000Z",
      reasonCode: this.#health === "healthy" ? null : `fixture_${this.#health}`,
    }
  }

  async submitOutbound(message: OutboundMessage): Promise<OutboundAcceptance> {
    const fingerprint = canonicalAdapterPayload(message)
    const existing = this.#submissions.get(message.operationId)
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error("Outbound operation payload drift")
      return existing.acceptance
    }
    const acceptance = {
      state: "accepted" as const,
      externalSubmissionId: `fixture-submission-${this.#submissions.size + 1}`,
      acceptedAt: "2026-01-01T00:00:00.000Z",
    }
    this.#submissions.set(message.operationId, { fingerprint, acceptance })
    return acceptance
  }

  async listInbound(input: {
    adapterAccountRef: string
    sourceRef: string
    cursor?: string
    limit: number
  }) {
    if (input.adapterAccountRef !== this.#accountRef) return { items: [], cursor: null }
    const items = [...this.#inbound.keys()]
      .sort()
      .filter((id) => !input.cursor || id > input.cursor)
      .slice(0, input.limit)
      .map((id) => ({ adapterAccountRef: this.#accountRef, sourceRef: this.#sourceRef, id }))
    return { items, cursor: items.at(-1)?.id ?? null }
  }

  async fetchInbound(ref: InboundItemRef): Promise<InboundEnvelope> {
    const envelope = this.#inbound.get(ref.id)
    if (!envelope) throw new Error("Inbound item not found")
    return structuredClone(envelope)
  }

  async ackInbound(ref: InboundItemRef): Promise<void> {
    this.#inbound.delete(ref.id)
  }

  async verifyInboundAuthenticity() {
    return this.#authentic
      ? ({ authentic: true } as const)
      : ({ authentic: false, code: "invalid_authenticity_proof" } as const)
  }

  async queueVerifiedInbound() {
    if (!this.#authentic)
      return { accepted: false as const, code: "invalid_authenticity_proof" as const }
    return { accepted: false as const, code: "invalid_payload" as const }
  }

  async verifyLifecycleAuthenticity() {
    return this.#authentic
      ? ({ authentic: true } as const)
      : ({ authentic: false, code: "invalid_authenticity_proof" } as const)
  }

  async queueVerifiedLifecycle() {
    return { accepted: this.#authentic }
  }

  async normalizeLifecycleEvents(input: { body: Uint8Array }): Promise<DeliveryLifecycleEvent[]> {
    return deliveryLifecycleEventSchema.array().parse(JSON.parse(textDecoder.decode(input.body)))
  }

  async listLifecycle(input: {
    adapterAccountRef: string
    sourceRef: string
    cursor?: string
    limit: number
  }) {
    const items = [...this.#lifecycle.keys()]
      .sort()
      .filter((id) => !input.cursor || id > input.cursor)
      .slice(0, input.limit)
      .map((id) => ({ adapterAccountRef: input.adapterAccountRef, sourceRef: input.sourceRef, id }))
    return { items, cursor: items.at(-1)?.id ?? null }
  }

  async fetchLifecycle(ref: import("./contracts.js").LifecycleItemRef) {
    const event = this.#lifecycle.get(ref.id)
    if (!event) throw new Error("Lifecycle item not found")
    return structuredClone(event)
  }

  async ackLifecycle(ref: import("./contracts.js").LifecycleItemRef) {
    this.#lifecycle.delete(ref.id)
  }

  async evaluatePolicy() {
    return this.#recipientSuppressed
      ? ({ allowed: false, code: "recipient_suppressed" } as const)
      : ({ allowed: true } as const)
  }

  async readPrivateAttachment(input: {
    adapterAccountRef: string
    sourceRef: string
    handle: string
  }): Promise<AsyncIterable<Uint8Array>> {
    const bytes = this.#attachments.get(input.handle)
    if (!bytes) throw new Error("Private attachment not found")
    const copy = new Uint8Array(bytes)
    return (async function* stream() {
      yield copy
    })()
  }

  enqueueInbound(envelope: InboundEnvelope): void {
    const parsed = inboundEnvelopeSchema.parse(envelope)
    if (this.#inbound.has(parsed.externalEnvelopeId)) throw new Error("Inbound item already exists")
    this.#inbound.set(parsed.externalEnvelopeId, parsed)
  }

  replaceInbound(envelope: InboundEnvelope): void {
    const parsed = inboundEnvelopeSchema.parse(envelope)
    this.#inbound.set(parsed.externalEnvelopeId, parsed)
  }

  setInboundAuthenticity(authentic: boolean): void {
    this.#authentic = authentic
  }

  setHealth(status: AdapterHealth["status"]): void {
    this.#health = status
  }

  setRecipientSuppressed(suppressed: boolean): void {
    this.#recipientSuppressed = suppressed
  }

  putPrivateAttachment(handle: string, bytes: Uint8Array): void {
    this.#attachments.set(handle, new Uint8Array(bytes))
  }

  enqueueLifecycle(event: DeliveryLifecycleEvent): void {
    this.#lifecycle.set(event.externalEventId, deliveryLifecycleEventSchema.parse(event))
  }
}

export function createFixtureChannelAdapterControl(
  channel: "email" | "sms" = "email",
): ChannelAdapterConformanceControl {
  const accountRef = `${channel}-fixture-account`
  const sourceRef = `${channel}-fixture-source`
  const adapter = new FixtureChannelAdapter({ channel, accountRef, sourceRef })
  return {
    adapter,
    accountRef,
    sourceRef,
    channel,
    enqueueInbound: (envelope) => adapter.enqueueInbound(envelope),
    replaceInbound: (envelope) => adapter.replaceInbound(envelope),
    setInboundAuthenticity: (authentic) => adapter.setInboundAuthenticity(authentic),
    setHealth: (status) => adapter.setHealth(status),
    setRecipientSuppressed: (suppressed) => adapter.setRecipientSuppressed(suppressed),
    putPrivateAttachment: (handle, bytes) => adapter.putPrivateAttachment(handle, bytes),
    enqueueLifecycle: (event) => adapter.enqueueLifecycle(event),
    lifecycleRequest: (events) => ({
      adapterAccountRef: accountRef,
      headers: {},
      body: textEncoder.encode(JSON.stringify(events)),
    }),
  }
}
