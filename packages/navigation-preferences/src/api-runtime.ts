import { OpenAPIHono } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { ApiModule } from "@voyant-travel/hono/module"

export const NAVIGATION_PREFERENCES_ROUTE_PATHS = [
  "/v1/admin/navigation-preferences",
  "/v1/admin/navigation-preferences/*",
] as const

export function createNavigationPreferencesApiModule(): ApiModule {
  return {
    module: { name: "navigation-preferences" },
    lazyRoutes: {
      paths: NAVIGATION_PREFERENCES_ROUTE_PATHS,
      load: () =>
        import("./routes.js").then((module) => {
          const app = new OpenAPIHono({ defaultHook: openApiValidationHook })
          app.route("/", module.createNavigationPreferencesRoutes())
          return app
        }),
    },
  }
}
