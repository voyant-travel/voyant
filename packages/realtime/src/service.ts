import type {
  MintClientTokenInput,
  MintedClientToken,
  RealtimeMessage,
  RealtimeProvider,
} from "./types.js"

export class RealtimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RealtimeError"
  }
}

/**
 * Thin router over one or more {@link RealtimeProvider}s. Most deployments use
 * a single backend, so this mirrors `createNotificationService`: resolve a
 * provider by name, defaulting to the first registered one.
 */
export interface RealtimeService {
  /** Publish via the default provider (or the named one when `provider` set). */
  publish(channel: string, message: RealtimeMessage, provider?: string): Promise<void>
  /** Mint a client token via the default provider (or the named one). */
  mintClientToken(input: MintClientTokenInput, provider?: string): Promise<MintedClientToken>
  /** Look up a registered provider by name. */
  getProvider(name: string): RealtimeProvider | undefined
  /** The provider used when no explicit name is given. */
  readonly defaultProvider: RealtimeProvider
}

export function createRealtimeService(providers: ReadonlyArray<RealtimeProvider>): RealtimeService {
  const first = providers[0]
  if (!first) {
    throw new RealtimeError("createRealtimeService requires at least one provider")
  }
  const defaultProvider: RealtimeProvider = first

  const byName = new Map<string, RealtimeProvider>()
  for (const provider of providers) {
    byName.set(provider.name, provider)
  }

  function resolve(name?: string): RealtimeProvider {
    if (!name) return defaultProvider
    const provider = byName.get(name)
    if (!provider) {
      throw new RealtimeError(`No realtime provider registered with name "${name}"`)
    }
    return provider
  }

  return {
    defaultProvider,
    async publish(channel, message, provider) {
      await resolve(provider).publish(channel, message)
    },
    async mintClientToken(input, provider) {
      return resolve(provider).mintClientToken(input)
    },
    getProvider(name) {
      return byName.get(name)
    },
  }
}
