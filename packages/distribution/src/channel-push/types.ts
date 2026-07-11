/**
 * Shared types for the channel-push pipeline.
 *
 * Per docs/architecture/channel-push-architecture.md §4-§6.
 */

import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyant-travel/db"

/**
 * Process-local dependencies the channel-push workers and subscribers
 * need. Templates wire this once at startup via `setChannelPushDeps`;
 * callers retrieve via `getChannelPushDeps`.
 *
 * The runtime indirection lets workflows (which can't take closures in
 * their durable input) and EventBus subscribers (which run in the
 * emitter's process) share the same wiring without each consumer
 * re-resolving services. Per §4.5 — subscribers stay write-only and
 * delegate HTTP work to the workflow, which reaches into these deps.
 */
export interface ChannelPushDeps {
  db: AnyDrizzleDb
  registry: SourceAdapterRegistry
  /**
   * Optional logger. Defaults to a console fallback. Subscribers and
   * workers log to this when they swallow errors per the EventBus
   * fire-and-forget contract.
   */
  logger?: ChannelPushLogger
}

export const CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY =
  "distribution.workflows.channel-push.runtime" as const

export interface ChannelPushLogger {
  info?: (message: string, meta?: Record<string, unknown>) => void
  warn?: (message: string, meta?: Record<string, unknown>) => void
  error: (message: string, meta?: Record<string, unknown>) => void
}

const DEPS_KEY = Symbol.for("voyant.distribution.channel-push.deps")

interface DepsHolder {
  [DEPS_KEY]?: ChannelPushDeps
}

const globalRef = globalThis as typeof globalThis & DepsHolder

/** Wire the channel-push pipeline at process start. Idempotent. */
export function setChannelPushDeps(deps: ChannelPushDeps): void {
  globalRef[DEPS_KEY] = deps
}

/** Retrieve the wired deps, throwing if templates haven't wired them. */
export function getChannelPushDepsOrThrow(): ChannelPushDeps {
  const deps = globalRef[DEPS_KEY]
  if (!deps) {
    throw new Error(
      "channel-push deps not wired — call setChannelPushDeps({ db, registry }) at process start",
    )
  }
  return deps
}

/** Retrieve the wired deps, returning undefined when none are wired. */
export function getChannelPushDeps(): ChannelPushDeps | undefined {
  return globalRef[DEPS_KEY]
}

/** Reset (test helper). */
export function clearChannelPushDeps(): void {
  delete globalRef[DEPS_KEY]
}

export const defaultLogger: ChannelPushLogger = {
  info: (message, meta) => console.log(`[channel-push] ${message}`, meta ?? ""),
  warn: (message, meta) => console.warn(`[channel-push] ${message}`, meta ?? ""),
  error: (message, meta) => console.error(`[channel-push] ${message}`, meta ?? ""),
}
