import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
  defineAdminExtension,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin/extensions"
import { PanelLeft } from "lucide-react"

import { loadNavigationPreferences, navigationPreferencesQueryKey } from "./client.js"
import { navigationSetupMessageDefinitions } from "./i18n/setup.js"

export function createSelectedNavigationPreferencesAdminExtension(
  context?: SelectedAdminExtensionFactoryContext,
): AdminExtension {
  const label =
    context?.navMessages.navigation ?? navigationSetupMessageDefinitions.en.navigationLabel
  return defineAdminExtension({
    id: "navigation-preferences",
    navigationPreferences: {
      queryKey: navigationPreferencesQueryKey,
      load: loadNavigationPreferences,
    },
    settingsPages: [
      {
        id: "navigation",
        path: "/navigation",
        title: label,
        label,
        icon: PanelLeft,
        group: "general",
        order: 15,
        page: () =>
          import("./navigation-preferences-page.js").then((module) =>
            adminRoutePageModule(module.NavigationPreferencesPage),
          ),
        routeMessagesProvider: () =>
          import("./i18n/provider.js").then((module) => ({
            default: module.NavigationPreferencesMessagesProvider,
          })),
      },
    ],
    setupSteps: [
      {
        id: "@voyant-travel/navigation-preferences#setup.organization-navigation",
        order: 50,
        skippable: true,
        href: "/settings/navigation",
        messages: navigationSetupMessageDefinitions,
        isComplete: hasOrganizationNavigation,
      },
    ],
  })
}

async function hasOrganizationNavigation(context: AdminRouteLoaderContext): Promise<boolean> {
  const preferences = await loadNavigationPreferences({
    baseUrl: context.runtime.baseUrl,
    fetcher: context.runtime.fetcher ?? fetch,
  })
  return Object.keys(preferences.organization).length > 0
}
