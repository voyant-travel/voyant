import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  AdapterPayloadDriftError,
  AdapterReplayLedger,
  runChannelAdapterConformance,
} from "../src/conformance.js"
import {
  CHANNEL_ADAPTER_PROTOCOL_VERSION,
  ChannelAdapterCompatibilityError,
  canonicalAdapterPayload,
  canonicalSchemaPayload,
  channelAdapterDescriptorSchema,
  negotiateChannelAdapter,
  outboundAcceptanceSchema,
  outboundMessageSchema,
  smsSegmentCount,
  validateChannelAdapter,
} from "../src/index.js"
import { createFixtureChannelAdapterControl, FixtureChannelAdapter } from "../src/testing.js"

describe("custom channel adapter contract", () => {
  it.each([
    "email",
    "sms",
  ] as const)("runs a complete %s Inbox flow through its channel-scoped account and source", async (channel) => {
    const result = await runChannelAdapterConformance(() =>
      createFixtureChannelAdapterControl(channel),
    )
    expect(result.passed).toEqual([
      "capability truthfulness and negotiation",
      "invalid authenticity proof rejection",
      "invalid lifecycle authenticity proof rejection",
      "outbound idempotency and payload drift",
      "fetch and acknowledgement crash safety, replay and payload drift",
      "delivery normalization, duplicate replay and payload drift",
      "lifecycle fetch and acknowledgement crash safety",
      "policy suppression",
      "private attachment streaming",
      "health transitions",
      "credential and configuration non-exposure",
    ])
  })

  it("fails setup negotiation on unsupported channels and capabilities", () => {
    const adapter = new FixtureChannelAdapter()
    expect(() =>
      negotiateChannelAdapter(adapter, {
        protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
        channel: "not-supported",
        capabilities: ["outbound"],
      }),
    ).toThrowError(ChannelAdapterCompatibilityError)
  })

  it("rejects capabilities that do not truthfully match the method surface", () => {
    const adapter = new FixtureChannelAdapter()
    const lyingAdapter = {
      descriptor: {
        ...adapter.descriptor,
        channels: adapter.descriptor.channels.map((channel) => ({ ...channel, outbound: false })),
      },
      provisionAccount: adapter.provisionAccount.bind(adapter),
      validateAccount: adapter.validateAccount.bind(adapter),
      getHealth: adapter.getHealth.bind(adapter),
      submitOutbound: adapter.submitOutbound.bind(adapter),
      listInbound: adapter.listInbound.bind(adapter),
      fetchInbound: adapter.fetchInbound.bind(adapter),
      ackInbound: adapter.ackInbound.bind(adapter),
      verifyInboundAuthenticity: adapter.verifyInboundAuthenticity.bind(adapter),
      queueVerifiedInbound: adapter.queueVerifiedInbound.bind(adapter),
      verifyLifecycleAuthenticity: adapter.verifyLifecycleAuthenticity.bind(adapter),
      queueVerifiedLifecycle: adapter.queueVerifiedLifecycle.bind(adapter),
      normalizeLifecycleEvents: adapter.normalizeLifecycleEvents.bind(adapter),
      listLifecycle: adapter.listLifecycle.bind(adapter),
      fetchLifecycle: adapter.fetchLifecycle.bind(adapter),
      ackLifecycle: adapter.ackLifecycle.bind(adapter),
      evaluatePolicy: adapter.evaluatePolicy.bind(adapter),
      readPrivateAttachment: adapter.readPrivateAttachment.bind(adapter),
    }
    expect(() => validateChannelAdapter(lyingAdapter)).toThrowError(/must exactly match/)
  })

  it("accepts identical replays and fails closed on payload drift", () => {
    const ledger = new AdapterReplayLedger()
    expect(ledger.observe("inbound", "item-1", { value: 1 })).toBe("new")
    expect(ledger.observe("inbound", "item-1", { value: 1 })).toBe("duplicate")
    expect(() => ledger.observe("inbound", "item-1", { value: 2 })).toThrowError(
      AdapterPayloadDriftError,
    )
  })

  it("rejects non-JSON canonical fingerprints, including explicit optional undefined", () => {
    expect(() => canonicalAdapterPayload(undefined)).toThrow(/JSON-compatible/)
    expect(() => canonicalAdapterPayload(Number.NaN)).toThrow(/finite/)
    expect(() => canonicalAdapterPayload(new Date())).toThrow(/plain JSON/)
    expect(() =>
      canonicalSchemaPayload(z.object({ value: z.string().optional() }), { value: undefined }),
    ).toThrow(/JSON-compatible/)
  })

  it("keeps credentials and adapter configuration outside public DTOs", () => {
    expect(() =>
      channelAdapterDescriptorSchema.parse({
        protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
        adapterId: "custom",
        channels: [
          {
            channel: "custom-channel",
            outbound: true,
            inbound: false,
            lifecycleEvents: false,
            policyEvaluation: false,
            privateAttachments: false,
            accountValidation: false,
            health: false,
            multimedia: false,
          },
        ],
        credentials: { token: "x" },
      }),
    ).toThrow()
    expect(() =>
      outboundAcceptanceSchema.parse({
        state: "accepted",
        externalSubmissionId: "submission-1",
        acceptedAt: "2026-01-01T00:00:00.000Z",
        configuration: { endpoint: "private" },
      }),
    ).toThrow()
  })

  it("keeps an item available across fetch until acknowledgement", async () => {
    const control = createFixtureChannelAdapterControl()
    const envelope = {
      protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
      adapterAccountRef: control.accountRef,
      sourceRef: control.sourceRef,
      channel: control.channel,
      externalEnvelopeId: "crash-safe-1",
      externalMessageId: "message-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      sender: { address: "customer@example.test", displayName: null },
      recipients: [{ address: "inbox@example.test", displayName: null }],
      subject: null,
      text: "Question",
      untrustedHtml: null,
      attachments: [],
      threadRef: null,
      replyToExternalMessageId: null,
      classification: "message" as const,
      sms: null,
    }
    control.enqueueInbound(envelope)
    const first = await control.adapter.listInbound?.({
      adapterAccountRef: control.accountRef,
      sourceRef: control.sourceRef,
      limit: 10,
    })
    await control.adapter.fetchInbound?.(first!.items[0]!)
    expect(
      await control.adapter.listInbound?.({
        adapterAccountRef: control.accountRef,
        sourceRef: control.sourceRef,
        limit: 10,
      }),
    ).toMatchObject({ items: [{ id: "crash-safe-1" }] })
    await control.adapter.ackInbound?.(first!.items[0]!)
    expect(
      await control.adapter.listInbound?.({
        adapterAccountRef: control.accountRef,
        sourceRef: control.sourceRef,
        limit: 10,
      }),
    ).toMatchObject({ items: [] })
  })

  it("enforces SMS address and segmentation boundaries", () => {
    expect(smsSegmentCount("")).toEqual({ encoding: "gsm7", segments: 0 })
    expect(smsSegmentCount("a".repeat(160))).toEqual({ encoding: "gsm7", segments: 1 })
    expect(smsSegmentCount("a".repeat(161))).toEqual({ encoding: "gsm7", segments: 2 })
    expect(smsSegmentCount("✓".repeat(70))).toEqual({ encoding: "ucs2", segments: 1 })
    expect(smsSegmentCount("✓".repeat(71))).toEqual({ encoding: "ucs2", segments: 2 })
    expect(smsSegmentCount("^".repeat(80))).toEqual({ encoding: "gsm7", segments: 1 })
    expect(smsSegmentCount("^".repeat(81))).toEqual({ encoding: "gsm7", segments: 2 })
    expect(smsSegmentCount("£".repeat(160))).toEqual({ encoding: "gsm7", segments: 1 })
    expect(() =>
      outboundMessageSchema.parse({
        operationId: "sms-1",
        adapterAccountRef: "account",
        channel: "sms",
        recipient: "2025550123",
        subject: null,
        text: "hello",
        sanitizedHtml: null,
        attachments: [],
        threadRef: null,
        metadata: {},
      }),
    ).toThrow(/E.164/)
  })
})
