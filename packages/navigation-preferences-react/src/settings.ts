import {
  type AdminExtension,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyant-travel/admin/extensions"
import { PanelLeft } from "lucide-react"

import { loadNavigationPreferences, navigationPreferencesQueryKey } from "./client.js"

export function createSelectedNavigationPreferencesAdminExtension(): AdminExtension {
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
        title: "Navigation",
        label: "Navigation",
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
  })
}
