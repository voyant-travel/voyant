import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import {
  type CustomFieldValueLifecycleRuntime,
  type CustomFieldValueOperationsRuntime,
  customFieldValueLifecycleRuntimePort,
  customFieldValueOperationsRuntimePort,
} from "@voyant-travel/core/runtime-port"
import { createCustomFieldTargetRegistry } from "@voyant-travel/custom-fields"
import { financeAppApiRuntimePort } from "@voyant-travel/finance-contracts/app-api"
import type { ApiModule } from "@voyant-travel/hono/module"
import { createAppsAppApiRoutes } from "./app-api-routes.js"
import { createAppOAuthService } from "./oauth-service.js"
import { createAppsAdminRoutes } from "./routes.js"
import { type AppsManagedAuthRuntime, appsManagedAuthRuntimePort } from "./runtime-port.js"

export const createAppsApiModule = defineGraphRuntimeFactory(
  async ({ getPort, getPorts, graph, hasPort }) => {
    const customFieldTargets = createCustomFieldTargetRegistry(graph.customFieldTargets ?? [])
    const customFieldValueLifecycles = await getPorts<CustomFieldValueLifecycleRuntime>(
      customFieldValueLifecycleRuntimePort,
    )
    const customFieldValueOperations = await getPorts<CustomFieldValueOperationsRuntime>(
      customFieldValueOperationsRuntimePort,
    )
    const finance = hasPort(financeAppApiRuntimePort)
      ? await getPort(financeAppApiRuntimePort)
      : undefined
    const managedAuth = hasPort(appsManagedAuthRuntimePort)
      ? await getPort<AppsManagedAuthRuntime>(appsManagedAuthRuntimePort)
      : undefined
    const oauthOptions = managedAuth
      ? {
          accessCatalog: graph.accessCatalog,
          deploymentId: managedAuth.runtimeAudience,
          managedInstallation: managedAuth.installationAuthority,
          clientAuthentication: "required" as const,
        }
      : undefined
    const oauth = oauthOptions ? createAppOAuthService(oauthOptions) : undefined
    return {
      module: { name: "apps" },
      adminRoutes: createAppsAdminRoutes({
        eventCatalog: graph.eventCatalog,
        ...(oauthOptions ? { oauth: oauthOptions } : {}),
        ...(managedAuth
          ? {
              sessionToken: {
                secret: managedAuth.sessionTokenSigningSecret,
                managedInstallation: managedAuth.installationAuthority,
                ...(managedAuth.sessionTokenTtlSeconds === undefined
                  ? {}
                  : { ttlSeconds: managedAuth.sessionTokenTtlSeconds }),
              },
            }
          : {}),
      }),
      ...(oauth
        ? {
            clientAuthenticated: [
              { method: "POST", path: "/oauth/token" },
              { method: "POST", path: "/oauth/session-token/exchange" },
            ] as const,
            authAugmentation: {
              resolveAppToken: ({ db, token }) =>
                oauth.resolveAccessToken(
                  db as Parameters<typeof oauth.resolveAccessToken>[0],
                  token,
                ),
            },
          }
        : {}),
      lazyRoutes: {
        paths: ["/v1/app", "/v1/app/*"],
        load: async () =>
          createAppsAppApiRoutes({
            customFieldTargets,
            customFieldValueLifecycles,
            customFieldValueOperations,
            finance,
          }),
      },
    } satisfies ApiModule
  },
)
