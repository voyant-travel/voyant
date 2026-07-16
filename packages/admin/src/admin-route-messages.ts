import type * as React from "react"

import type {
  AdminExtension,
  AdminRouteMessagesProvider,
  AdminRouteMessagesProviderModule,
  AdminUiRouteContribution,
} from "./extensions.js"

export type AdminRouteMessagesProviderLoader = () => Promise<AdminRouteMessagesProviderModule>

/** Attach one lazy package-copy provider to every rendered route in an extension. */
export function withAdminRouteMessagesProvider(
  extension: AdminExtension,
  routeMessagesProvider: AdminRouteMessagesProviderLoader,
): AdminExtension {
  const apply = (route: AdminUiRouteContribution): AdminUiRouteContribution => ({
    ...route,
    ...(route.redirectTo
      ? {}
      : { routeMessagesProvider: route.routeMessagesProvider ?? routeMessagesProvider }),
    ...(route.children ? { children: route.children.map(apply) } : {}),
  })

  return {
    ...extension,
    ...(extension.routes ? { routes: extension.routes.map(apply) } : {}),
  }
}

/** Compose package-copy providers without pulling React or message tables into shell chrome. */
export function composeAdminRouteMessagesProviders(
  ...loaders: readonly AdminRouteMessagesProviderLoader[]
): AdminRouteMessagesProviderLoader {
  return async () => {
    const [{ createElement }, ...modules] = await Promise.all([
      import("react"),
      ...loaders.map((load) => load()),
    ])
    const providers = modules.map((module) => module.default)
    const ComposedProvider: AdminRouteMessagesProvider = ({ children, locale, timeZone }) =>
      providers.reduceRight<React.ReactNode>(
        (content, Provider) => createElement(Provider, { children: content, locale, timeZone }),
        children,
      )

    return { default: ComposedProvider }
  }
}
