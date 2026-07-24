import type {
  NotificationChannel,
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from "../types.js"

/**
 * Options for {@link createLocalProvider}.
 */
export interface LocalProviderOptions {
  /** Channels this provider advertises. Defaults to `["email", "sms"]`. */
  channels?: ReadonlyArray<NotificationChannel>
  /** Default sender used for local email delivery logs. */
  defaultFromAddress?: string | null
  /**
   * Optional sink for captured payloads. Defaults to `console.log`.
   * Tests can pass a vi.fn() to capture notifications without console noise.
   */
  sink?: (payload: NotificationPayload) => void
  /** Provider name (defaults to `"local"`). Useful for stacking multiple locals. */
  name?: string
}

/**
 * Create a development/test notification provider that captures sends to a
 * sink (console by default) and returns synthetic message ids. Never makes
 * network calls.
 */
export function createLocalProvider(options: LocalProviderOptions = {}): NotificationProvider {
  const name = options.name ?? "local"
  const channels = options.channels ?? ["email", "sms"]
  const defaultFromAddress =
    options.defaultFromAddress ?? (channels.includes("email") ? "local@example.test" : null)
  const sink =
    options.sink ??
    ((payload: NotificationPayload) => {
      console.log(`[notifications:${name}]`, payload)
    })

  let counter = 0
  return {
    name,
    channels,
    defaultFromAddress,
    durableDelivery: {
      supported: false,
      reason:
        "The process-local provider cannot preserve provider idempotency across process restarts.",
    },
    async send(payload): Promise<NotificationResult> {
      counter += 1
      sink(payload)
      return { id: `${name}_${counter}`, provider: name }
    },
  }
}
