import {
  type ChannelAdapterV1,
  validateChannelAdapter,
} from "@voyant-travel/channel-adapter-contracts/adapter-manifest"
import { definePort } from "@voyant-travel/core/project"

export interface CommunicationsAdapterAccountBinding {
  adapterAccountRef: string
  sourceRef: string
  channel: "email" | "sms"
  /** Host-normalized sender/receiving identity used for account-specific dispatch. */
  address: string
  /** Persisted Notifications account id, required for inbound SMS policy projection. */
  channelAccountId?: string
  inbound: boolean
  outbound: boolean
}

export interface CommunicationsAdapterBundle {
  readonly adapter: ChannelAdapterV1
  readonly accounts: readonly CommunicationsAdapterAccountBinding[]
  /** Streams ephemeral adapter bytes into the deployment private-documents authority. */
  importInboundAttachment?(input: {
    sourceId: string
    externalId: string
    filename: string
    contentType: string
    sizeBytes: number
    bytes: AsyncIterable<Uint8Array>
  }): Promise<{ privateHandle: string; filename: string; contentType: string; sizeBytes: number }>
  /** Isolated backend probe used by Notifications durable-provider conformance. */
  createIsolatedProbe(): Promise<{
    adapter: ChannelAdapterV1
    restart(): Promise<ChannelAdapterV1>
    acceptedCount(operationId: string): number | Promise<number>
  }>
}

export const communicationsAdapterBundlePort = definePort<CommunicationsAdapterBundle>({
  id: "communications.channel-adapter-bundle",
  test: assertCommunicationsAdapterBundle,
})

export function assertCommunicationsAdapterBundle(bundle: CommunicationsAdapterBundle): void {
  const descriptor = validateChannelAdapter(bundle.adapter)
  if (!Array.isArray(bundle.accounts) || typeof bundle.createIsolatedProbe !== "function") {
    throw new Error("communications adapter bundle requires accounts and an isolated probe")
  }
  for (const account of bundle.accounts) {
    if (!account.address.trim()) throw new Error("Communications account address is required")
    const channel = descriptor.channels.find((entry) => entry.channel === account.channel)
    if (!channel) throw new Error(`Communications adapter does not declare ${account.channel}`)
    if (!account.inbound || !account.outbound) {
      throw new Error(`Selected Inbox account ${account.channel} must be two-way`)
    }
    if (
      !channel.inbound ||
      !channel.outbound ||
      !channel.lifecycleEvents ||
      !channel.policyEvaluation ||
      !channel.accountValidation ||
      !channel.health
    ) {
      throw new Error(`Two-way ${account.channel} setup is incomplete`)
    }
    if (account.inbound && channel.privateAttachments && !bundle.importInboundAttachment) {
      throw new Error("Inbound attachments require a private documents importer")
    }
    if (account.channel === "sms" && channel.multimedia && !channel.privateAttachments) {
      throw new Error("SMS multimedia requires scoped private attachment reads")
    }
    if (account.channel === "sms" && account.inbound && !account.channelAccountId?.trim()) {
      throw new Error("Inbound SMS requires its persisted Channel Account id")
    }
  }
}
