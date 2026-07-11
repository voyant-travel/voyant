/**
 * Operator dependency wiring for the package-owned channel-push extension.
 */

import { createChannelPushExtension as createDistributionChannelPushExtension } from "@voyant-travel/distribution"
import type { HonoExtension } from "@voyant-travel/hono/module"

import { getBookingEngineRegistryFromContext } from "../lib/booking-engine-runtime"

/**
 * Channel-push admin API as a composed distribution extension.
 *
 * `createApp` mounts the extension's `adminRoutes` at
 * `/v1/admin/distribution` (the target module), so the package routes
 * keep their existing absolute paths. The operator dashboard's "channel
 * sync" view consumes these endpoints.
 *
 * The per-request middleware wires `setChannelPushDeps` from the
 * request-scoped Pool the `dbFromEnvForApp` middleware installs on
 * `c.var.db`, plus the operator's booking-engine registry, so the admin
 * routes' push/reconcile triggers resolve deps via
 * `getChannelPushDepsOrThrow`. It is scoped to this extension's own
 * routes (mirroring the former additionalRoutes mount, which only ever
 * wrapped the channel-push routes — the distribution module routes do
 * not read channel-push deps).
 *
 * Replaces the former `mountChannelPushAdminRoutes(...)` additionalRoutes
 * hop; see docs/architecture/api-route-ownership-and-composition.md.
 * Per docs/architecture/channel-push-architecture.md §9 + §14.5.
 */
export function createChannelPushExtension(
  createExtension: typeof createDistributionChannelPushExtension = createDistributionChannelPushExtension,
): HonoExtension {
  return createExtension({
    resolveRegistry: getBookingEngineRegistryFromContext,
  })
}
