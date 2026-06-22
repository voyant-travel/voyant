import type {
  MintClientTokenInput,
  MintedClientToken,
  RealtimeMessage,
  RealtimeProvider,
} from "../types.js"

/**
 * The subset of the Cloud SDK `realtime` namespace this provider uses —
 * `publish(channel, { event, data })` and `tokens.mint(input)`. Declared
 * structurally (rather than importing `VoyantCloudClient`) to keep this package
 * free of a hard `@voyant-travel/cloud-sdk` dependency; the real
 * `getVoyantCloudClient(env)` satisfies it directly, so deployments pass the SDK
 * client with no cast.
 *
 * @see https://github.com/voyant-travel/voyant/issues/1695
 */
export interface RealtimeCloudNamespace {
  publish(channel: string, input: { event: string; data?: unknown }): Promise<unknown>
  tokens: {
    mint(input: MintClientTokenInput): Promise<MintedClientToken>
  }
}

export interface RealtimeCloudClient {
  realtime: RealtimeCloudNamespace
}

export interface VoyantCloudRealtimeProviderOptions {
  /**
   * Cloud SDK client. Construct via `getVoyantCloudClient(env)` and pass it
   * here; this provider only touches its `realtime` namespace.
   */
  client: RealtimeCloudClient
  /** Provider name override (defaults to `"voyant-cloud"`). */
  name?: string
}

/**
 * Realtime provider backed by Voyant Cloud. All transport, auth, and error
 * handling come from the SDK — no hand-rolled fetch — exactly like
 * `createVoyantCloudEmailProvider`.
 */
export function createVoyantCloudRealtimeProvider(
  options: VoyantCloudRealtimeProviderOptions,
): RealtimeProvider {
  const name = options.name ?? "voyant-cloud"
  return {
    name,
    async publish(channel: string, message: RealtimeMessage) {
      await options.client.realtime.publish(channel, {
        event: message.event,
        data: message.data,
      })
    },
    mintClientToken(input: MintClientTokenInput): Promise<MintedClientToken> {
      return options.client.realtime.tokens.mint(input)
    },
  }
}
