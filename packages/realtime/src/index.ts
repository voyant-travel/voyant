import type { Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoModule } from "@voyant-travel/hono/module"
import {
  createAdminInvalidationPublicationPort,
  registerAdminInvalidationPublicationPort,
} from "./admin-invalidation-subscriber.js"
import { createRealtimeBridge } from "./bridge.js"
import {
  buildRealtimeRouteRuntime,
  createRealtimeRoutes,
  REALTIME_OPENAPI_API_IDS,
  REALTIME_ROUTE_RUNTIME_CONTAINER_KEY,
  type RealtimeRoutesOptions,
} from "./routes.js"
import { realtimeRuntimePort } from "./runtime-port.js"
import type { RealtimeRoutes } from "./types.js"

export type {
  AdminInvalidationPublicationPort,
  AdminInvalidationPublishErrorContext,
  AdminInvalidationRoute,
  CreateAdminInvalidationPublicationPortOptions,
  CreateAdminInvalidationSubscriberOptions,
  CreateAdminInvalidationSubscriberRuntimeOptions,
} from "./admin-invalidation-subscriber.js"
export {
  ADMIN_INVALIDATION_PUBLICATION_RUNTIME_KEY,
  createAdminInvalidationPublicationPort,
  createAdminInvalidationSubscriber,
  createAdminInvalidationSubscriberRuntime,
  registerAdminInvalidationPublicationPort,
} from "./admin-invalidation-subscriber.js"
export type { CreateRealtimeBridgeOptions } from "./bridge.js"
export { createRealtimeBridge } from "./bridge.js"
export type {
  PortalScope,
  RealtimeCapabilityContext,
} from "./capabilities.js"
export { resolveRealtimeCapabilities } from "./capabilities.js"
export type {
  LocalRealtimeListener,
  LocalRealtimeProvider,
  LocalRealtimeProviderOptions,
} from "./providers/local.js"
export { createLocalRealtimeProvider } from "./providers/local.js"
export type {
  RealtimeCloudClient,
  RealtimeCloudNamespace,
  VoyantCloudRealtimeProviderOptions,
} from "./providers/voyant-cloud.js"
export { createVoyantCloudRealtimeProvider } from "./providers/voyant-cloud.js"
export type {
  RealtimeRouteRuntime,
  RealtimeRoutesOptions,
  ResolvePortalScope,
} from "./routes.js"
export {
  buildRealtimeRouteRuntime,
  createRealtimeRoutes,
  REALTIME_OPENAPI_API_IDS,
  REALTIME_ROUTE_RUNTIME_CONTAINER_KEY,
} from "./routes.js"
export type { RealtimeService } from "./service.js"
export { createRealtimeService, RealtimeError } from "./service.js"
export type {
  MintClientTokenInput,
  MintedClientToken,
  RealtimeCapabilities,
  RealtimeCapability,
  RealtimeInvalidationHint,
  RealtimeMessage,
  RealtimeProvider,
  RealtimeRoute,
  RealtimeRouteResult,
  RealtimeRoutes,
} from "./types.js"

/** Core module identity. The realtime module owns no schema — it is stateless. */
export const realtimeModule: Module = {
  name: "realtime",
}

export interface CreateRealtimeHonoModuleOptions extends RealtimeRoutesOptions {
  /**
   * Declarative event → channel routing table. When set, deferred EventBus
   * subscribers are registered at bootstrap to fan domain events out to
   * realtime channels as invalidation hints.
   */
  bridgeRoutes?: RealtimeRoutes
  /** Optional sink for bridge publish failures (defaults to `console.warn`). */
  onPublishError?: (error: unknown, context: { event: string; channel: string }) => void
}

/**
 * Assemble the realtime {@link HonoModule}: the token-mint route (mounted on
 * both admin and public surfaces) plus, when `bridgeRoutes` is supplied, the
 * deferred EventBus → channel bridge.
 *
 * The module is fully optional: with no providers configured the token route
 * returns 503 and no subscribers are registered, so deployments can adopt
 * realtime incrementally (or never).
 */
export function createRealtimeHonoModule(
  options: CreateRealtimeHonoModuleOptions = {},
): HonoModule {
  const adminRoutes = createRealtimeRoutes(options, REALTIME_OPENAPI_API_IDS.admin)
  const publicRoutes = createRealtimeRoutes(options, REALTIME_OPENAPI_API_IDS.public)

  const module: Module = {
    ...realtimeModule,
    bootstrap: ({ bindings, container, eventBus }) => {
      const runtime = buildRealtimeRouteRuntime(bindings as Record<string, unknown>, options)
      container.register(REALTIME_ROUTE_RUNTIME_CONTAINER_KEY, runtime)

      if (runtime.service) {
        registerAdminInvalidationPublicationPort(
          container,
          createAdminInvalidationPublicationPort({
            provider: runtime.service.defaultProvider,
            onError: options.onPublishError,
          }),
        )
      }

      // No provider configured → nothing to publish to; stay inert.
      if (runtime.service && options.bridgeRoutes && Object.keys(options.bridgeRoutes).length > 0) {
        const subscribers = createRealtimeBridge({
          provider: runtime.service.defaultProvider,
          routes: options.bridgeRoutes,
          onError: options.onPublishError,
        })
        for (const subscriber of subscribers) {
          eventBus.subscribe(subscriber.event, subscriber.handler, {
            inline: subscriber.inline ?? false,
          })
        }
      }
    },
  }

  return {
    module,
    adminRoutes,
    publicRoutes,
  }
}

/** Package-owned adapter from the graph port registry to the public module factory. */
export const createRealtimeVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) =>
  createRealtimeHonoModule(await getPort(realtimeRuntimePort)),
)

export { realtimeRuntimePort } from "./runtime-port.js"
