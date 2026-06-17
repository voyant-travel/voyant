/**
 * The `@voyant-travel/operator-settings` HonoModule — the standard settings
 * surface mounted by `@voyant-travel/framework`'s composition. Routes live at
 * stable absolute paths, so the module uses `lazyRoutes` (explicit matchers +
 * a lazily-imported route bundle, cached per isolate).
 */

import type { HonoModule } from "@voyant-travel/hono/module"
import { Hono } from "hono"

/** Stable absolute matchers for the operator-settings admin + public routes. */
export const OPERATOR_SETTINGS_ROUTE_PATHS = [
  "/v1/admin/settings/*",
  "/v1/public/operator-profile",
  "/v1/public/settings/operator",
] as const

export function createOperatorSettingsHonoModule(): HonoModule {
  return {
    module: { name: "operator-settings" },
    lazyRoutes: {
      paths: OPERATOR_SETTINGS_ROUTE_PATHS,
      load: () =>
        import("./routes.js").then((m) => {
          const app = new Hono()
          m.mountOperatorSettingsRoutes(app)
          return app
        }),
    },
  }
}
