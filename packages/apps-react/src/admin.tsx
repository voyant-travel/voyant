import {
  type AdminExtension,
  adminRoutePageModule,
  defineAdminExtension,
  type SelectedAdminExtensionFactoryContext,
  withAdminRouteMessagesProvider,
} from "@voyant-travel/admin"
import { Boxes } from "lucide-react"

import { appsUiEn } from "./i18n/en.js"

export interface CreateAppsAdminExtensionOptions {
  path?: string
  developerPath?: string
  title?: string
  developerTitle?: string
  order?: number
}

const appsRouteMessagesProvider = () =>
  import("./i18n/index.js").then((module) => ({ default: module.AppsUiMessagesProvider }))

/** Package-owned admin surface for the app governance and developer UI. */
export function createAppsAdminExtension(
  options: CreateAppsAdminExtensionOptions = {},
): AdminExtension {
  const path = options.path ?? "/apps"
  const developerPath = options.developerPath ?? "/apps/developer"
  const title = options.title ?? appsUiEn.navigation.title
  const developerTitle = options.developerTitle ?? appsUiEn.navigation.developerTitle

  return withAdminRouteMessagesProvider(
    defineAdminExtension({
      id: "apps",
      navigation: [
        {
          order: options.order ?? 170,
          items: [
            {
              id: "apps",
              title,
              url: path,
              icon: Boxes,
              items: [
                { id: "apps-installed", title, url: path },
                { id: "apps-developer", title: developerTitle, url: developerPath },
              ],
            },
          ],
        },
      ],
      routes: [
        {
          id: "apps-index",
          path,
          title,
          ssr: "data-only",
          capability: "apps:read",
          page: () =>
            import("./components/installed-apps-page.js").then((module) =>
              adminRoutePageModule(module.InstalledAppsPage),
            ),
        },
        {
          id: "apps-developer",
          path: developerPath,
          title: developerTitle,
          ssr: "data-only",
          capability: "apps:write",
          page: () =>
            import("./components/developer-apps-page.js").then((module) =>
              adminRoutePageModule(module.DeveloperAppsPage),
            ),
        },
      ],
    }),
    appsRouteMessagesProvider,
  )
}

/** Selected-graph adapter for the standard Operator distribution. */
export function createSelectedAppsAdminExtension(
  { navMessages }: SelectedAdminExtensionFactoryContext = { navMessages: {} },
): AdminExtension {
  return createAppsAdminExtension({
    title: navMessages.apps ?? appsUiEn.navigation.title,
    developerTitle: navMessages.appsDeveloper ?? appsUiEn.navigation.developerTitle,
  })
}
