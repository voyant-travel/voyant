import {
  accountProvisioningResultSchema,
  accountValidationResultSchema,
  adapterHealthSchema,
  CHANNEL_ADAPTER_PROTOCOL_VERSION,
  type ChannelAdapterV1,
  canonicalAdapterPayload,
  channelAdapterDescriptorSchema,
  type DeliveryLifecycleEvent,
  deliveryLifecycleEventSchema,
  type InboundEnvelope,
  inboundAuthenticityResultSchema,
  inboundEnvelopeSchema,
  negotiateChannelAdapter,
  outboundAcceptanceSchema,
  policyEvaluationResultSchema,
} from "./contracts.js"

export class AdapterPayloadDriftError extends Error {
  constructor(readonly identity: string) {
    super(`Adapter replay payload drift detected for ${identity}`)
    this.name = "AdapterPayloadDriftError"
  }
}

/** Minimal host-side ledger model used by the reusable conformance scenarios. */
export class AdapterReplayLedger {
  readonly #fingerprints = new Map<string, string>()

  observe(
    namespace: "inbound" | "lifecycle",
    identity: string,
    payload: unknown,
  ): "new" | "duplicate" {
    const key = `${namespace}:${identity}`
    const fingerprint = canonicalAdapterPayload(payload)
    const existing = this.#fingerprints.get(key)
    if (existing === undefined) {
      this.#fingerprints.set(key, fingerprint)
      return "new"
    }
    if (existing !== fingerprint) throw new AdapterPayloadDriftError(identity)
    return "duplicate"
  }
}

export interface ChannelAdapterConformanceControl {
  readonly adapter: ChannelAdapterV1
  readonly accountRef: string
  readonly sourceRef: string
  readonly channel: string
  enqueueInbound(envelope: InboundEnvelope): void
  replaceInbound(envelope: InboundEnvelope): void
  setInboundAuthenticity(authentic: boolean): void
  setHealth(status: "healthy" | "degraded" | "unavailable"): void
  setRecipientSuppressed(suppressed: boolean): void
  putPrivateAttachment(handle: string, bytes: Uint8Array): void
  enqueueLifecycle(event: DeliveryLifecycleEvent): void
  lifecycleRequest(events: readonly DeliveryLifecycleEvent[]): {
    adapterAccountRef: string
    headers: Record<string, string>
    body: Uint8Array<ArrayBuffer>
  }
}

export interface ChannelAdapterConformanceResult {
  readonly passed: readonly string[]
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/**
 * Runs transport-neutral scenarios against a fresh adapter harness. It has no
 * test-runner dependency, so adapter repositories can call it from any suite.
 */
export async function runChannelAdapterConformance(
  createControl: () => ChannelAdapterConformanceControl,
): Promise<ChannelAdapterConformanceResult> {
  const passed: string[] = []

  {
    const control = createControl()
    negotiateChannelAdapter(control.adapter, {
      protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
      channel: control.channel,
      capabilities: [
        "outbound",
        "inbound",
        "lifecycleEvents",
        "policyEvaluation",
        "privateAttachments",
        "accountValidation",
        "health",
      ],
    })
    const validateAccount = requireValue(
      control.adapter.validateAccount,
      "validateAccount is missing",
    ).bind(control.adapter)
    const valid = accountValidationResultSchema.parse(
      await validateAccount({
        adapterAccountRef: control.accountRef,
        requiredChannels: [control.channel],
        requiredCapabilities: [
          "outbound",
          "inbound",
          "lifecycleEvents",
          "policyEvaluation",
          "health",
        ],
      }),
    )
    assert(valid.valid, "configured account must validate")
    const missing = accountValidationResultSchema.parse(
      await validateAccount({
        adapterAccountRef: "conformance-missing-account",
        requiredChannels: [control.channel],
        requiredCapabilities: [],
      }),
    )
    assert(!missing.valid, "an unknown account reference must fail validation")
    const provision = requireValue(
      control.adapter.provisionAccount,
      "provisionAccount is missing",
    ).bind(control.adapter)
    const provisionInput = {
      operationId: "conformance-provision-1",
      channel: control.channel,
      address: control.channel === "sms" ? "+12025550100" : "inbox@example.test",
      displayName: "Inbox",
      inbound: true,
      outbound: true,
    }
    const firstProvision = accountProvisioningResultSchema.parse(await provision(provisionInput))
    const replayProvision = accountProvisioningResultSchema.parse(
      await provision({ ...provisionInput }),
    )
    assert(
      firstProvision.adapterAccountRef === replayProvision.adapterAccountRef,
      "provision replay must return the same account",
    )
    assert(
      firstProvision.inboundSourceRef === control.sourceRef,
      "provisioning must return the channel-scoped inbound source",
    )
    let provisionDriftRejected = false
    try {
      await provision({
        ...provisionInput,
        address: control.channel === "sms" ? "+12025550101" : "other@example.test",
      })
    } catch {
      provisionDriftRejected = true
    }
    assert(provisionDriftRejected, "provision operation payload drift must fail closed")
    passed.push("capability truthfulness and negotiation")
  }

  {
    const control = createControl()
    control.setInboundAuthenticity(false)
    const verify = requireValue(
      control.adapter.verifyInboundAuthenticity,
      "inbound authenticity method is missing",
    ).bind(control.adapter)
    const result = inboundAuthenticityResultSchema.parse(
      await verify({
        adapterAccountRef: control.accountRef,
        headers: {},
        body: new Uint8Array([1]),
      }),
    )
    assert(!result.authentic, "an invalid authenticity proof must be rejected")
    const queue = requireValue(
      control.adapter.queueVerifiedInbound,
      "queueVerifiedInbound is missing",
    ).bind(control.adapter)
    const queued = await queue({
      adapterAccountRef: control.accountRef,
      headers: {},
      body: new Uint8Array([1]),
    })
    assert(!queued.accepted, "invalid raw bytes must not be queued")
    const page = await requireValue(control.adapter.listInbound, "listInbound is missing").call(
      control.adapter,
      { adapterAccountRef: control.accountRef, sourceRef: control.sourceRef, limit: 10 },
    )
    assert(page.items.length === 0, "invalid raw bytes must never become listable")
    passed.push("invalid authenticity proof rejection")
  }

  {
    const control = createControl()
    control.setInboundAuthenticity(false)
    const verify = requireValue(
      control.adapter.verifyLifecycleAuthenticity,
      "lifecycle authenticity method is missing",
    ).bind(control.adapter)
    const result = inboundAuthenticityResultSchema.parse(await verify(control.lifecycleRequest([])))
    assert(!result.authentic, "an invalid lifecycle authenticity proof must be rejected")
    passed.push("invalid lifecycle authenticity proof rejection")
  }

  {
    const control = createControl()
    const submit = requireValue(control.adapter.submitOutbound, "submitOutbound is missing").bind(
      control.adapter,
    )
    const message = fixtureOutboundMessage(control)
    const first = outboundAcceptanceSchema.parse(await submit(message))
    const duplicate = outboundAcceptanceSchema.parse(await submit({ ...message }))
    assert(
      first.externalSubmissionId === duplicate.externalSubmissionId,
      "an identical operation replay must return the original acceptance",
    )
    let rejected = false
    try {
      await submit({ ...message, text: "drift" })
    } catch {
      rejected = true
    }
    assert(rejected, "an outbound operation replay with payload drift must fail closed")
    passed.push("outbound idempotency and payload drift")
  }

  {
    const control = createControl()
    const envelope = fixtureEnvelope(control)
    const ledger = new AdapterReplayLedger()
    control.enqueueInbound(envelope)
    const list = requireValue(control.adapter.listInbound, "listInbound is missing").bind(
      control.adapter,
    )
    const fetch = requireValue(control.adapter.fetchInbound, "fetchInbound is missing").bind(
      control.adapter,
    )
    const ack = requireValue(control.adapter.ackInbound, "ackInbound is missing").bind(
      control.adapter,
    )
    const beforeFetch = await list({
      adapterAccountRef: control.accountRef,
      sourceRef: control.sourceRef,
      limit: 10,
    })
    assert(beforeFetch.items.length === 1, "queued inbound item must be listed")
    const firstPayload = inboundEnvelopeSchema.parse(await fetch(beforeFetch.items[0]!))
    if (control.channel === "email") {
      assert(
        firstPayload.threadRef === "conformance-thread-1",
        "thread reference must be preserved",
      )
      assert(
        firstPayload.replyToExternalMessageId === "conformance-parent-1",
        "reply relationship must be preserved",
      )
    } else {
      assert(firstPayload.sender.address === "+12025550123", "SMS sender must remain strict E.164")
      assert(
        firstPayload.recipients[0]?.address === "+12025550100",
        "SMS receiving identity must remain strict E.164",
      )
      assert(firstPayload.sms?.policyEvent === "hard_opt_out", "SMS policy event must be preserved")
      assert(
        firstPayload.sms?.adapterHandledResponse,
        "SMS adapter-handled response must be preserved",
      )
    }
    assert(
      ledger.observe("inbound", firstPayload.externalEnvelopeId, firstPayload) === "new",
      "first inbound item must be new",
    )
    const afterCrash = await list({
      adapterAccountRef: control.accountRef,
      sourceRef: control.sourceRef,
      limit: 10,
    })
    assert(afterCrash.items.length === 1, "fetch without ack must leave the item available")
    const duplicatePayload = inboundEnvelopeSchema.parse(await fetch(afterCrash.items[0]!))
    assert(
      ledger.observe("inbound", duplicatePayload.externalEnvelopeId, duplicatePayload) ===
        "duplicate",
      "refetched payload must be an identical duplicate",
    )
    control.replaceInbound({ ...envelope, text: "drift" })
    const driftedPayload = inboundEnvelopeSchema.parse(await fetch(afterCrash.items[0]!))
    let driftRejected = false
    try {
      ledger.observe("inbound", driftedPayload.externalEnvelopeId, driftedPayload)
    } catch (error) {
      driftRejected = error instanceof AdapterPayloadDriftError
    }
    assert(driftRejected, "refetched payload drift must fail closed")
    await ack(beforeFetch.items[0]!)
    const afterAck = await list({
      adapterAccountRef: control.accountRef,
      sourceRef: control.sourceRef,
      limit: 10,
    })
    assert(afterAck.items.length === 0, "acknowledged item must leave the queue")
    passed.push("fetch and acknowledgement crash safety, replay and payload drift")
  }

  {
    const control = createControl()
    const normalize = requireValue(
      control.adapter.normalizeLifecycleEvents,
      "normalizeLifecycleEvents is missing",
    ).bind(control.adapter)
    const event = fixtureLifecycleEvent(control)
    const events = deliveryLifecycleEventSchema
      .array()
      .parse(await normalize(control.lifecycleRequest([event])))
    assert(
      events.length === 1 && events[0]?.state === "delivered",
      "lifecycle state must normalize",
    )
    const ledger = new AdapterReplayLedger()
    assert(ledger.observe("lifecycle", event.externalEventId, events[0]) === "new", "first event")
    assert(
      ledger.observe("lifecycle", event.externalEventId, events[0]) === "duplicate",
      "identical lifecycle replay must be accepted as a duplicate",
    )
    let rejected = false
    try {
      ledger.observe("lifecycle", event.externalEventId, { ...event, state: "failed" })
    } catch (error) {
      rejected = error instanceof AdapterPayloadDriftError
    }
    assert(rejected, "lifecycle replay payload drift must fail closed")
    passed.push("delivery normalization, duplicate replay and payload drift")
  }

  {
    const control = createControl()
    const event = fixtureLifecycleEvent(control)
    control.enqueueLifecycle(event)
    const list = requireValue(control.adapter.listLifecycle, "listLifecycle is missing").bind(
      control.adapter,
    )
    const fetch = requireValue(control.adapter.fetchLifecycle, "fetchLifecycle is missing").bind(
      control.adapter,
    )
    const ack = requireValue(control.adapter.ackLifecycle, "ackLifecycle is missing").bind(
      control.adapter,
    )
    const page = await list({
      adapterAccountRef: control.accountRef,
      sourceRef: control.sourceRef,
      limit: 10,
    })
    const fetched = deliveryLifecycleEventSchema.parse(await fetch(page.items[0]!))
    assert(fetched.externalEventId === event.externalEventId, "lifecycle event must fetch")
    assert(
      (
        await list({
          adapterAccountRef: control.accountRef,
          sourceRef: control.sourceRef,
          limit: 10,
        })
      ).items.length === 1,
      "lifecycle fetch must not acknowledge",
    )
    await ack(page.items[0]!)
    assert(
      (
        await list({
          adapterAccountRef: control.accountRef,
          sourceRef: control.sourceRef,
          limit: 10,
        })
      ).items.length === 0,
      "lifecycle acknowledgement removes the event",
    )
    passed.push("lifecycle fetch and acknowledgement crash safety")
  }

  {
    const control = createControl()
    const evaluate = requireValue(control.adapter.evaluatePolicy, "evaluatePolicy is missing").bind(
      control.adapter,
    )
    control.setRecipientSuppressed(true)
    const result = policyEvaluationResultSchema.parse(
      await evaluate({
        adapterAccountRef: control.accountRef,
        channel: control.channel,
        recipient: control.channel === "sms" ? "+12025550123" : "suppressed@example.test",
        purpose: "conversation",
      }),
    )
    assert(!result.allowed && result.code === "recipient_suppressed", "suppression must block send")
    passed.push("policy suppression")
  }

  {
    const control = createControl()
    const read = requireValue(
      control.adapter.readPrivateAttachment,
      "readPrivateAttachment is missing",
    ).bind(control.adapter)
    control.putPrivateAttachment("conformance-attachment-1", new Uint8Array([1, 2, 3]))
    const stream = await read({
      adapterAccountRef: control.accountRef,
      sourceRef: control.sourceRef,
      handle: "conformance-attachment-1",
    })
    const bytes: number[] = []
    for await (const chunk of stream) bytes.push(...chunk)
    assert(bytes.join(",") === "1,2,3", "private attachment bytes must stream without a public URL")
    passed.push("private attachment streaming")
  }

  {
    const control = createControl()
    const health = requireValue(control.adapter.getHealth, "getHealth is missing").bind(
      control.adapter,
    )
    control.setHealth("healthy")
    assert(
      adapterHealthSchema.parse(await health({ adapterAccountRef: control.accountRef })).status ===
        "healthy",
      "healthy",
    )
    control.setHealth("degraded")
    assert(
      adapterHealthSchema.parse(await health({ adapterAccountRef: control.accountRef })).status ===
        "degraded",
      "degraded",
    )
    control.setHealth("unavailable")
    assert(
      adapterHealthSchema.parse(await health({ adapterAccountRef: control.accountRef })).status ===
        "unavailable",
      "unavailable",
    )
    passed.push("health transitions")
  }

  {
    const control = createControl()
    const descriptor = channelAdapterDescriptorSchema.parse(control.adapter.descriptor)
    const serialized = canonicalAdapterPayload(descriptor).toLowerCase()
    assert(!serialized.includes("credential"), "descriptor must not expose credentials")
    assert(!serialized.includes("secret"), "descriptor must not expose secrets")
    assert(!serialized.includes("configuration"), "descriptor must not expose configuration")
    passed.push("credential and configuration non-exposure")
  }

  return { passed }
}

function fixtureOutboundMessage(control: ChannelAdapterConformanceControl) {
  return {
    operationId: "conformance-operation-1",
    adapterAccountRef: control.accountRef,
    channel: control.channel,
    recipient: control.channel === "sms" ? "+12025550123" : "customer@example.test",
    subject: control.channel === "sms" ? null : "Conformance",
    text: "Hello",
    sanitizedHtml: null,
    attachments: [],
    threadRef: null,
    metadata: {},
  }
}

function fixtureEnvelope(control: ChannelAdapterConformanceControl): InboundEnvelope {
  return {
    protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
    adapterAccountRef: control.accountRef,
    sourceRef: control.sourceRef,
    channel: control.channel,
    externalEnvelopeId: "conformance-envelope-1",
    externalMessageId: "conformance-message-1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    sender: {
      address: control.channel === "sms" ? "+12025550123" : "sender@example.test",
      displayName: null,
    },
    recipients: [
      {
        address: control.channel === "sms" ? "+12025550100" : "inbox@example.test",
        displayName: null,
      },
    ],
    subject: control.channel === "sms" ? null : "Conformance",
    text: "Hello",
    untrustedHtml: null,
    attachments: [],
    threadRef: "conformance-thread-1",
    replyToExternalMessageId: "conformance-parent-1",
    classification: "message",
    sms:
      control.channel === "sms"
        ? { policyEvent: "hard_opt_out", adapterHandledResponse: true }
        : null,
  }
}

function fixtureLifecycleEvent(control: ChannelAdapterConformanceControl): DeliveryLifecycleEvent {
  return {
    adapterAccountRef: control.accountRef,
    externalEventId: "conformance-event-1",
    externalSubmissionId: "conformance-submission-1",
    occurredAt: "2026-01-01T00:01:00.000Z",
    state: "delivered",
    reasonCode: null,
  }
}
