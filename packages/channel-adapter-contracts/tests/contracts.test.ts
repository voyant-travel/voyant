import { describe, expect, it } from "vitest"
import {
  AdapterPayloadDriftError,
  AdapterReplayLedger,
  runChannelAdapterConformance,
} from "../src/conformance.js"
import {
  CHANNEL_ADAPTER_PROTOCOL_VERSION,
  ChannelAdapterCompatibilityError,
  channelAdapterDescriptorSchema,
  negotiateChannelAdapter,
  outboundAcceptanceSchema,
  validateChannelAdapter,
} from "../src/index.js"
import { createFixtureChannelAdapterControl, FixtureChannelAdapter } from "../src/testing.js"

describe("custom channel adapter contract", () => {
  it("runs the reusable conformance suite against the deterministic fixture", async () => {
    const result = await runChannelAdapterConformance(createFixtureChannelAdapterControl)
    expect(result.passed).toEqual([
      "capability truthfulness and negotiation",
      "invalid authenticity proof rejection",
      "invalid lifecycle authenticity proof rejection",
      "outbound idempotency and payload drift",
      "fetch and acknowledgement crash safety, replay and payload drift",
      "delivery normalization, duplicate replay and payload drift",
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
        capabilities: { ...adapter.descriptor.capabilities, outbound: false },
      },
      validateAccount: adapter.validateAccount.bind(adapter),
      getHealth: adapter.getHealth.bind(adapter),
      submitOutbound: adapter.submitOutbound.bind(adapter),
      listInbound: adapter.listInbound.bind(adapter),
      fetchInbound: adapter.fetchInbound.bind(adapter),
      ackInbound: adapter.ackInbound.bind(adapter),
      verifyInboundAuthenticity: adapter.verifyInboundAuthenticity.bind(adapter),
      verifyLifecycleAuthenticity: adapter.verifyLifecycleAuthenticity.bind(adapter),
      normalizeLifecycleEvents: adapter.normalizeLifecycleEvents.bind(adapter),
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

  it("keeps credentials and adapter configuration outside public DTOs", () => {
    expect(() =>
      channelAdapterDescriptorSchema.parse({
        protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
        adapterId: "custom",
        capabilities: {
          channels: ["custom-channel"],
          outbound: true,
          inbound: false,
          lifecycleEvents: false,
          policyEvaluation: false,
          privateAttachments: false,
          accountValidation: false,
          health: false,
        },
        credentials: { token: "must-not-cross-the-boundary" },
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
    }
    control.enqueueInbound(envelope)
    const first = await control.adapter.listInbound?.({
      adapterAccountRef: control.accountRef,
      limit: 10,
    })
    await control.adapter.fetchInbound?.(first!.items[0]!)
    expect(
      await control.adapter.listInbound?.({ adapterAccountRef: control.accountRef, limit: 10 }),
    ).toMatchObject({ items: [{ id: "crash-safe-1" }] })
    await control.adapter.ackInbound?.(first!.items[0]!)
    expect(
      await control.adapter.listInbound?.({ adapterAccountRef: control.accountRef, limit: 10 }),
    ).toMatchObject({ items: [] })
  })
})
