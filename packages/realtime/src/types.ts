import type { EventEnvelope } from "@voyant-travel/core"

/**
 * A realtime capability granted on a channel. Mirrors the capability
 * vocabulary the transport service understands.
 */
export type RealtimeCapability = "subscribe" | "publish" | "presence"

/**
 * Map of channel name (or pattern such as `booking:*`) to the capabilities
 * the holder is granted on it.
 */
export type RealtimeCapabilities = Record<string, ReadonlyArray<RealtimeCapability>>

/**
 * A message published to a channel. `event` follows the framework's
 * `<resource>.<pastTenseAction>` convention; `data` is the payload subscribers
 * receive. For the EventBus bridge the payload is an
 * {@link RealtimeInvalidationHint}, never the entity itself.
 */
export interface RealtimeMessage {
  event: string
  data: unknown
}

/**
 * Input for minting a short-lived client token a browser uses to connect to
 * the transport. The token encodes the {@link RealtimeCapabilities} so the
 * client can only subscribe to channels it is entitled to.
 */
export interface MintClientTokenInput {
  /** Stable identifier for the connecting client (typically the user id). */
  clientId: string
  /** Channels → capabilities the token grants. */
  capabilities: RealtimeCapabilities
  /** Optional token lifetime; the provider applies its own default/cap. */
  ttlSeconds?: number
}

/**
 * A minted client token plus its expiry, returned to the browser.
 */
export interface MintedClientToken {
  token: string
  /** ISO-8601 timestamp at which the token stops being valid. */
  expiresAt: string
}

/**
 * A pluggable realtime transport. Voyant Cloud is one implementation; any
 * pub/sub backend (Ably, Pusher, Centrifugo, a self-hosted WebSocket/SSE
 * service, …) can satisfy this interface.
 *
 * Built-in implementations:
 * - `createLocalRealtimeProvider` — in-memory pub/sub for dev/tests and the
 *   reference implementation.
 * - `createVoyantCloudRealtimeProvider` — delegates to the Cloud SDK's
 *   `realtime` namespace.
 *
 * Self-hosters who want a different backend implement this interface in their
 * deployment and pass it to {@link createRealtimeBridge} and the token route.
 */
export interface RealtimeProvider {
  /** Unique provider name (e.g. "voyant-cloud", "local", "ably"). */
  readonly name: string
  /** Fan a message out to subscribers of `channel`. */
  publish(channel: string, message: RealtimeMessage): Promise<void>
  /** Mint a short-lived, capability-scoped client token. */
  mintClientToken(input: MintClientTokenInput): Promise<MintedClientToken>
}

/**
 * Default channel-message payload: an invalidation *hint*, not the entity.
 *
 * The React layer reacts by invalidating matching React Query keys and
 * refetching over the existing authenticated HTTP path. This keeps HTTP the
 * source of truth, makes at-most-once delivery acceptable (a missed hint
 * self-heals on the next refetch/staleTime tick), and avoids leaking entity
 * data through channel capabilities.
 */
export interface RealtimeInvalidationHint {
  /** Originating domain event, e.g. `booking.confirmed`. */
  event: string
  /** Entity family the hint concerns, e.g. `booking`. */
  entity: string
  /** Optional id of the affected entity. */
  id?: string
}

/**
 * Result a route function may return to customise the published message. The
 * terse form — returning a `string[]` of channels — is also supported, in
 * which case the hint defaults to `{ event, entity: <resource>, id: undefined }`.
 */
export interface RealtimeRouteResult {
  channels: ReadonlyArray<string>
  /** Overrides merged onto the default {@link RealtimeInvalidationHint}. */
  hint?: Partial<RealtimeInvalidationHint>
}

/**
 * Maps a domain event to the channels it should fan out to. Receives the
 * event payload and the full envelope.
 */
export type RealtimeRoute<TData = unknown> = (
  data: TData,
  envelope: EventEnvelope<TData>,
) => ReadonlyArray<string> | RealtimeRouteResult

/**
 * Declarative event → channel routing table for {@link createRealtimeBridge}.
 * Keyed by domain event name.
 */
export type RealtimeRoutes = Record<string, RealtimeRoute>
