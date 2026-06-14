import type { Extension, Module } from "@voyant-travel/core"
import type { Hono } from "hono"

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
  /**
   * Optional override for the public mount path relative to `/v1/public`.
   *
   * Defaults to `{extension.module}`. Use `"/"` to mount an extension directly
   * at the public root and omit the extra module segment.
   */
  publicPath?: string
}
