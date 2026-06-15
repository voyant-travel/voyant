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
}
