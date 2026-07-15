import type {
  MintClientTokenInput,
  MintedClientToken,
  RealtimeMessage,
  RealtimeProvider,
} from "../types.js"

export type LocalRealtimeListener = (message: RealtimeMessage) => void

export interface LocalRealtimeProviderOptions {
  /** Provider name (defaults to `"local"`). */
  name?: string
  /**
   * Optional sink for every published message (across all channels). Defaults
   * to `console.log`. Tests can pass a `vi.fn()` to capture publishes.
   */
  sink?: (channel: string, message: RealtimeMessage) => void
  /** Default token lifetime in seconds (defaults to 3600). */
  defaultTtlSeconds?: number
}

/**
 * In-memory realtime provider for development, tests, and as the reference
 * implementation. Supports per-channel subscription so an in-process consumer
 * (or a test) can observe fan-out without a network transport.
 */
export interface LocalRealtimeProvider extends RealtimeProvider {
  /** Subscribe an in-process listener to a channel. Returns an unsubscribe fn. */
  subscribe(channel: string, listener: LocalRealtimeListener): () => void
}

export function createLocalRealtimeProvider(
  options: LocalRealtimeProviderOptions = {},
): LocalRealtimeProvider {
  const name = options.name ?? "local"
  const defaultTtlSeconds = options.defaultTtlSeconds ?? 3600
  const sink =
    options.sink ??
    ((channel: string, message: RealtimeMessage) => {
      console.log(`[realtime:${name}] ${channel}`, message)
    })

  const listeners = new Map<string, Set<LocalRealtimeListener>>()
  let tokenCounter = 0

  return {
    name,
    async publish(channel, message) {
      sink(channel, message)
      const channelListeners = listeners.get(channel)
      if (channelListeners) {
        for (const listener of channelListeners) {
          listener(message)
        }
      }
    },
    async mintClientToken(input: MintClientTokenInput): Promise<MintedClientToken> {
      tokenCounter += 1
      const ttl = input.ttlSeconds ?? defaultTtlSeconds
      // Opaque, non-cryptographic token — local provider never authenticates a
      // real transport. The capability set is embedded for inspectability.
      const token = `${name}_${tokenCounter}.${input.clientId}`
      return {
        token,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      }
    },
    subscribe(channel, listener) {
      let set = listeners.get(channel)
      if (!set) {
        set = new Set()
        listeners.set(channel, set)
      }
      set.add(listener)
      return () => {
        set?.delete(listener)
      }
    },
  }
}

/** First-party local implementation selected by deployment.providers.realtime. */
export function createLocalGraphRealtimeProvider(): RealtimeProvider {
  return createLocalRealtimeProvider()
}
