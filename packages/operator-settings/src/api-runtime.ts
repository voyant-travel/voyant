/**
 * The `@voyant-travel/operator-settings` ApiModule — the standard settings
 * surface mounted by `@voyant-travel/framework`'s composition. Routes live at
 * stable absolute paths, so the module uses `lazyRoutes` (explicit matchers +
 * a lazily-imported route bundle, cached per isolate).
 *
 * The loaded bundle is an `OpenAPIHono` (carrying the `defaultHook` that shapes
 * request-validation failures) so its `createRoute(...).openapi(...)` operations
 * are visible to the build-time `mergeLazyOpenApiPaths` replay (voyant#2114).
 */

import { OpenAPIHono } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { ApiModule } from "@voyant-travel/hono/module"

/** Stable absolute matchers for the operator-settings admin + public routes. */
export const OPERATOR_SETTINGS_ROUTE_PATHS = [
  "/v1/admin/settings/*",
  "/v1/public/operator-profile",
  "/v1/public/settings/operator",
] as const

export function createOperatorSettingsApiModule(): ApiModule {
  return {
    module: { name: "operator-settings" },
    lazyRoutes: {
      paths: OPERATOR_SETTINGS_ROUTE_PATHS,
      load: () =>
        import("./routes.js").then((m) => {
          const app = new OpenAPIHono({ defaultHook: openApiValidationHook })
          m.mountOperatorSettingsRoutes(app)
          return app
        }),
    },
  }
}
