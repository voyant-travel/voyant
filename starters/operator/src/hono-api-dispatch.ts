import { createVoyantNodeApiDispatch } from "@voyant-travel/framework/node-host"
import { lazyApp } from "@voyant-travel/runtime"

/**
 * App-owned loaders for the framework-owned dispatch in
 * `@voyant-travel/runtime`: this file only knows WHICH modules to load;
 * prefix matching, URL rewriting, lean-auth dispatch, and background API
 * warm-up live in the package and arrive via version bumps.
 */

const loadOperatorApiApp = lazyApp<AppBindings, ExecutionContext>(() =>
  import("./api/app").then((mod) => ({
    fetch: (request, env, ctx) => mod.app.fetch(request, env as AppBindings, ctx),
  })),
)

const loadOperatorAuthHandler = lazyApp<AppBindings, ExecutionContext>(() =>
  import("./api/auth/handler").then((mod) => ({
    fetch: (request, env, ctx) => mod.default.fetch(request, env as AppBindings, ctx),
  })),
)

export const operatorApiDispatch = createVoyantNodeApiDispatch<AppBindings, ExecutionContext>({
  loadApiApp: loadOperatorApiApp,
  loadAuthHandler: loadOperatorAuthHandler,
  rewriteAppPath: (pathname) =>
    pathname.startsWith("/v1/media/")
      ? pathname.replace("/v1/media/", "/v1/admin/media/")
      : pathname,
})
