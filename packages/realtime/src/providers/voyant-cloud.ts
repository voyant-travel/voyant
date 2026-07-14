import { createVoyantCloudClient } from "@voyant-travel/cloud-sdk"

import type {
  MintClientTokenInput,
  MintedClientToken,
  RealtimeMessage,
  RealtimeProvider,
} from "../types.js"

export const REALTIME_VOYANT_CLOUD_API_KEY_SECRET_ID =
  "@voyant-travel/realtime#secret.voyant-cloud-api-key"
export const REALTIME_VOYANT_CLOUD_BASE_URL_CONFIG_ID =
  "@voyant-travel/realtime#config.voyant-cloud-base-url"
export const REALTIME_VOYANT_CLOUD_USER_AGENT_CONFIG_ID =
  "@voyant-travel/realtime#config.voyant-cloud-user-agent"

interface VoyantCloudGraphProviderContext {
  getConfig: <T = unknown>(declarationId: string) => T | undefined
  getSecret: <T = unknown>(declarationId: string) => T | undefined
}

/**
 * The subset of the Cloud SDK `realtime` namespace this provider uses —
 * `publish(channel, { event, data })` and `tokens.mint(input)`. Declared
 * structurally (rather than importing `VoyantCloudClient`) to keep this package
 * independent of the SDK's full client type. The graph-selected provider
 * factory constructs the SDK client and passes its realtime namespace here.
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
   * Cloud SDK client. Graph-selected deployments construct it from declared
   * values; this provider only touches its `realtime` namespace.
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

/** First-party Cloud implementation selected by deployment.providers.realtime. */
export function createVoyantCloudGraphRealtimeProvider(
  context: VoyantCloudGraphProviderContext,
): RealtimeProvider {
  const apiKey = requiredString(
    context.getSecret(REALTIME_VOYANT_CLOUD_API_KEY_SECRET_ID),
    "VOYANT_API_KEY",
  )
  const baseUrl = optionalString(
    context.getConfig(REALTIME_VOYANT_CLOUD_BASE_URL_CONFIG_ID),
    "VOYANT_CLOUD_API_URL",
  )
  const userAgent = optionalString(
    context.getConfig(REALTIME_VOYANT_CLOUD_USER_AGENT_CONFIG_ID),
    "VOYANT_CLOUD_USER_AGENT",
  )
  const client = createVoyantCloudClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    ...(userAgent ? { userAgent } : {}),
  })
  return createVoyantCloudRealtimeProvider({ client })
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`)
  }
  return value.trim()
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string when configured.`)
  }
  return value.trim()
}
