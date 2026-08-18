import { CHANNEL_ADAPTER_PROTOCOL_VERSION } from "@voyant-travel/channel-adapter-contracts"
import { FixtureChannelAdapter } from "@voyant-travel/channel-adapter-contracts/testing"
import { describe, expect, it, vi } from "vitest"
import { createCommunicationsAdapterBridge } from "../src/bridge.js"
import type { CommunicationsAdapterBundle } from "../src/runtime-port.js"

function adapterFor(channel: "email" | "sms") {
  return new FixtureChannelAdapter({
    accountRef: "fixture-account",
    sourceRef: `${channel}-fixture-source`,
    channel,
  })
}

function bundle(adapter: FixtureChannelAdapter): CommunicationsAdapterBundle {
  return {
    adapter,
    accounts: [],
    async importInboundAttachment(input) {
      const bytes: number[] = []
      for await (const chunk of input.bytes) bytes.push(...chunk)
      return {
        privateHandle: `documents:${bytes.join("-")}`,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: bytes.length,
      }
    },
    async createIsolatedProbe() {
      return {
        adapter,
        async restart() {
          return adapterFor(adapter.descriptor.channels[0]!.channel as "email" | "sms")
        },
        acceptedCount: () => 1,
      }
    },
  }
}

describe("communications adapter graph bridge", () => {
  it("provisions, validates, activates and immediately sends through the bound account", async () => {
    const adapter = adapterFor("email")
    const bridge = createCommunicationsAdapterBridge(bundle(adapter))
    const provider = bridge.durableRuntime.providers[0]!
    const capability = provider.channelAccounts!
    const provisioned = await capability.provision({
      channel: "email",
      address: "inbox@example.test",
      displayName: "Inbox",
      allowedPurposes: ["conversation-reply"],
      inboundCapable: true,
      outboundCapable: true,
    })
    expect(await capability.validate(provisioned.adapterRef)).toMatchObject({
      inboundCapable: true,
      outboundCapable: true,
      inboundSourceId: "fixture-channel-adapter:inbound",
    })
    await capability.activate?.({
      channelAccountId: "channel-account-1",
      adapterRef: provisioned.adapterRef,
    })
    await expect(
      provider.durableDelivery.send(
        {
          channel: "email",
          to: "guest@example.test",
          from: "inbox@example.test",
          template: "rendered",
          purpose: "conversation-reply",
          text: "Hello",
        },
        { idempotencyKey: "send-1" },
      ),
    ).resolves.toMatchObject({ id: "fixture-submission-1" })
  })

  it("rejects outbound-only Inbox bindings and incomplete two-way setup", () => {
    const adapter = adapterFor("email")
    expect(() =>
      createCommunicationsAdapterBridge({
        ...bundle(adapter),
        accounts: [
          {
            adapterAccountRef: "fixture-account",
            sourceRef: "email-fixture-source",
            channel: "email",
            address: "inbox@example.test",
            inbound: false,
            outbound: true,
          },
        ],
      }),
    ).toThrow(/two-way/)

    adapter.descriptor.channels[0] = {
      ...adapter.descriptor.channels[0]!,
      policyEvaluation: false,
    }
    expect(() =>
      createCommunicationsAdapterBridge({
        ...bundle(adapter),
        accounts: [
          {
            adapterAccountRef: "fixture-account",
            sourceRef: "email-fixture-source",
            channel: "email",
            address: "inbox@example.test",
            inbound: true,
            outbound: true,
          },
        ],
      }),
    ).toThrow(/must exactly match|incomplete/)
  })

  it("evaluates authoritative purpose and suppression before outbound submission", async () => {
    const adapter = adapterFor("sms")
    const evaluatePolicy = vi.spyOn(adapter, "evaluatePolicy")
    const bridge = createCommunicationsAdapterBridge({
      ...bundle(adapter),
      accounts: [
        {
          adapterAccountRef: "fixture-account",
          sourceRef: "sms-fixture-source",
          channel: "sms",
          address: "+12025550100",
          channelAccountId: "channel-account-1",
          inbound: true,
          outbound: true,
        },
      ],
    })
    adapter.setRecipientSuppressed(true)
    await expect(
      bridge.durableRuntime.providers[0]!.durableDelivery.send(
        {
          channel: "sms",
          to: "+12025550123",
          from: "+12025550100",
          template: "rendered",
          purpose: "conversation-reply",
          text: "Hello",
        },
        { idempotencyKey: "suppressed-send-1" },
      ),
    ).rejects.toThrow(/recipient_suppressed/)
    expect(evaluatePolicy).toHaveBeenCalledWith({
      adapterAccountRef: "fixture-account",
      channel: "sms",
      recipient: "+12025550123",
      purpose: "conversation",
    })
    adapter.setRecipientSuppressed(false)
    await expect(
      bridge.durableRuntime.providers[0]!.durableDelivery.send(
        {
          channel: "sms",
          to: "+12025550123",
          from: "+12025550100",
          template: "rendered",
          purpose: "conversation-reply",
          text: "Hello",
        },
        { idempotencyKey: "allowed-send-1" },
      ),
    ).resolves.toMatchObject({ id: "fixture-submission-1" })
  })

  it("rejects provisioning configuration drift", async () => {
    const adapter = adapterFor("email")
    const capability = createCommunicationsAdapterBridge(bundle(adapter)).durableRuntime
      .providers[0]!.channelAccounts!
    const draft = {
      channel: "email" as const,
      address: "inbox@example.test",
      displayName: "Inbox",
      allowedPurposes: ["conversation-reply"],
      inboundCapable: true,
      outboundCapable: true,
    }
    await capability.provision(draft)
    await expect(capability.provision({ ...draft, displayName: "Changed" })).rejects.toThrow(
      /payload drift/,
    )
    await expect(capability.provision({ ...draft, inboundCapable: false })).rejects.toThrow(
      /two-way/,
    )
  })

  it("imports scoped attachment bytes without exposing the adapter handle as durable storage", async () => {
    const adapter = adapterFor("email")
    const bridge = createCommunicationsAdapterBridge(bundle(adapter))
    const capability = bridge.durableRuntime.providers[0]!.channelAccounts!
    const provisioned = await capability.provision({
      channel: "email",
      address: "inbox@example.test",
      displayName: "Inbox",
      allowedPurposes: [],
      inboundCapable: true,
      outboundCapable: true,
    })
    await capability.activate?.({
      channelAccountId: "channel-account-1",
      adapterRef: provisioned.adapterRef,
    })
    adapter.putPrivateAttachment("raw-adapter-handle", new Uint8Array([1, 2, 3]))
    adapter.enqueueInbound({
      protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
      adapterAccountRef: provisioned.adapterRef,
      sourceRef: "email-fixture-source",
      channel: "email",
      externalEnvelopeId: "envelope-1",
      externalMessageId: "message-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      sender: { address: "guest@example.test", displayName: null },
      recipients: [{ address: "inbox@example.test", displayName: null }],
      subject: "Question",
      text: "Hello",
      untrustedHtml: null,
      attachments: [
        { handle: "raw-adapter-handle", filename: "note.txt", contentType: "text/plain", size: 3 },
      ],
      threadRef: null,
      replyToExternalMessageId: null,
      classification: "message",
      sms: null,
    })
    const page = await bridge.ingressSource.list({ limit: 10 })
    const envelope = await bridge.ingressSource.fetch(page.items[0]!)
    expect(envelope.attachments[0]!.privateHandle).not.toContain("raw-adapter-handle")
    const replay = await bridge.ingressSource.fetch(page.items[0]!)
    await expect(
      bridge.ingressSource.importInboundAttachment!({
        sourceId: bridge.ingressSource.id,
        externalId: "raw-adapter-handle",
        privateHandle: envelope.attachments[0]!.privateHandle,
        filename: "note.txt",
        contentType: "text/plain",
        sizeBytes: 3,
      }),
    ).rejects.toThrow(/not pending/)
    await expect(
      bridge.ingressSource.importInboundAttachment!({
        sourceId: bridge.ingressSource.id,
        externalId: "raw-adapter-handle",
        privateHandle: replay.attachments[0]!.privateHandle,
        filename: "note.txt",
        contentType: "text/plain",
        sizeBytes: 3,
      }),
    ).resolves.toMatchObject({ privateHandle: "documents:1-2-3" })
    const uncommittedReplay = await bridge.ingressSource.fetch(page.items[0]!)
    await bridge.ingressSource.ack(page.items[0]!)
    await expect(
      bridge.ingressSource.importInboundAttachment!({
        sourceId: bridge.ingressSource.id,
        externalId: "raw-adapter-handle",
        privateHandle: uncommittedReplay.attachments[0]!.privateHandle,
        filename: "note.txt",
        contentType: "text/plain",
        sizeBytes: 3,
      }),
    ).rejects.toThrow(/not pending/)
  })

  it("makes unavailable health affect send and polling behavior", async () => {
    const adapter = adapterFor("email")
    const bridge = createCommunicationsAdapterBridge({
      ...bundle(adapter),
      accounts: [
        {
          adapterAccountRef: "fixture-account",
          sourceRef: "email-fixture-source",
          channel: "email",
          address: "inbox@example.test",
          inbound: true,
          outbound: true,
        },
      ],
    })
    adapter.setHealth("unavailable")
    await expect(
      bridge.durableRuntime.providers[0]!.durableDelivery.send(
        {
          channel: "email",
          to: "guest@example.test",
          from: "inbox@example.test",
          template: "rendered",
          text: "Hello",
        },
        { idempotencyKey: "send-1" },
      ),
    ).rejects.toThrow(/unavailable/)
    await expect(bridge.ingressSource.list({ limit: 10 })).resolves.toMatchObject({ items: [] })
  })
})
