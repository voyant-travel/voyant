import type { Extension, Module } from "@voyant-travel/core"
import type { Hono } from "hono"

import type { LazyHonoRoutes, LazyRoutesLoader } from "./lazy-routes.js"

export interface HonoModule {
  module: Module
  /**
   * Legacy routes — mounted at `/v1/{module.name}`. Gated by the caller's
   * `requireAuth` configuration. Use `adminRoutes` / `publicRoutes` for new
   * modules that participate in the admin/public API split.
   *
   * @deprecated Prefer `adminRoutes` or `publicRoutes`.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  routes?: Hono<any>
  /** Staff-facing routes — mounted at `/v1/admin/{module.name}`. */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  adminRoutes?: Hono<any>
  /** Customer/partner/supplier-facing routes — mounted at `/v1/public/{module.name}`. */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  publicRoutes?: Hono<any>
  /**
   * Inbound webhook routes — e.g. a payment-processor callback POSTed by an
   * external system with no session. Mounted at `/v1/{module.name}` (so existing
   * processor-registered callback URLs are preserved), and their concrete paths
   * are AUTOMATICALLY added to the anonymous allow-list (ADR-0008) — no
   * `anonymous` declaration or `publicPaths` entry needed. The handler is
   * responsible for verifying the provider signature. Distinct from `routes`
   * (deprecated catch-all) and from `publicRoutes` (session-bearing customer
   * surface): a webhook is unauthenticated by construction and verified in-band.
   * Only concrete paths are auto-allow-listed; parameterized/wildcard webhook
   * paths must additionally be declared via `anonymous`.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  webhookRoutes?: Hono<any>
  /**
   * Lazy variant of `adminRoutes` — the route bundle is dynamically imported on
   * first request and cached per isolate. Mounted at `/v1/admin/{module.name}`
   * with the request context bridged in, so it behaves identically to eager
   * `adminRoutes`. Use for heavy route families to protect Worker cold start.
   */
  lazyAdminRoutes?: LazyRoutesLoader
  /** Lazy variant of `publicRoutes` — mounted at `/v1/public/{publicPath ?? module.name}`. */
  lazyPublicRoutes?: LazyRoutesLoader
  /**
   * Deployment-local lazy family spanning explicit absolute path matchers (for
   * route bundles that don't fit a single admin/public surface). The loader
   * returns ABSOLUTE routes; the framework mounts + caches them with the request
   * context bridged in. Context-preserving replacement for `mountLazyRouteApp`.
   */
  lazyRoutes?: LazyHonoRoutes
  /**
   * Optional override for the public mount path relative to `/v1/public`.
   *
   * Defaults to `{module.name}`. Use `"/"` to mount a module directly at the
   * public root and omit the extra module segment.
   */
  publicPath?: string
  /**
   * Declares which of this module's PUBLIC routes are reachable without a
   * session (ADR-0008). `true` = the whole public mount is anonymous; a string
   * array = specific sub-paths relative to the public mount (e.g.
   * `["/contact-exists"]` on a module mounted at `/v1/public/customer-portal`
   * opens `/v1/public/customer-portal/contact-exists`). The framework assembles
   * the global anonymous allow-list from these declarations, so the
   * "reachable-without-auth" decision lives next to the route rather than in a
   * hand-maintained `publicPaths` list. Anonymous public requests are stamped
   * `actor: "customer"`. Only affects the public surface — admin routes always
   * require a `staff` actor.
   */
  anonymous?: boolean | readonly string[]
  /**
   * Absolute API path prefixes whose requests must be served by the
   * transaction-capable db client (ADR-0008). For modules whose
   * transaction-needing routes are NOT under the name-based surface — e.g. a
   * lazy family mounted at `/v1/admin/catalog/quote` rather than
   * `/v1/admin/{name}` — and where only a SUBSET of the family's routes
   * transact (so the boolean `module.requiresTransactionalDb` would be too
   * broad). For the common case (all of a module's routes transact) prefer
   * `module.requiresTransactionalDb`. Folded into the transactional-prefix map
   * so the deployment doesn't hand-maintain `dbTransactionalPaths`.
   */
  transactionalPaths?: readonly string[]
}

export interface HonoExtension {
  extension: Extension
  /** @deprecated Prefer `adminRoutes` or `publicRoutes`. */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  routes?: Hono<any>
  /** Staff-facing routes — mounted at `/v1/admin/{extension.module}`. */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  adminRoutes?: Hono<any>
  /** Customer/partner/supplier-facing routes — mounted at `/v1/public/{extension.module}`. */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  publicRoutes?: Hono<any>
  /**
   * Inbound webhook routes — mounted at `/v1/{extension.module}`, concrete paths
   * auto-added to the anonymous allow-list (ADR-0008). See `HonoModule.webhookRoutes`.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Hono sub-apps have varied env generics -- owner: hono; existing suppression is intentional pending typed cleanup.
  webhookRoutes?: Hono<any>
  /** Lazy variant of `adminRoutes` — mounted at `/v1/admin/{extension.module}` (see HonoModule). */
  lazyAdminRoutes?: LazyRoutesLoader
  /** Lazy variant of `publicRoutes` — mounted at `/v1/public/{publicPath ?? extension.module}`. */
  lazyPublicRoutes?: LazyRoutesLoader
  /** Deployment-local lazy family at explicit absolute paths (see HonoModule). */
  lazyRoutes?: LazyHonoRoutes
  /**
   * Optional override for the public mount path relative to `/v1/public`.
   *
   * Defaults to `{extension.module}`. Use `"/"` to mount an extension directly
   * at the public root and omit the extra module segment.
   */
  publicPath?: string
  /**
   * Declares which of this extension's PUBLIC routes are reachable without a
   * session (ADR-0008). Same semantics as {@link HonoModule.anonymous}, relative
   * to the extension's public mount.
   */
  anonymous?: boolean | readonly string[]
  /**
   * Absolute transactional path prefixes — same semantics as
   * {@link HonoModule.transactionalPaths}.
   */
  transactionalPaths?: readonly string[]
}
