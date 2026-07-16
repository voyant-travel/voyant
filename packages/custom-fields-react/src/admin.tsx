import {
  type AdminExtension,
  adminRoutePageModule,
  defineAdminExtension,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin"
import { SlidersHorizontal } from "lucide-react"

import { customFieldsUiEn } from "./i18n/en.js"

const customFieldsRouteMessagesProvider = () =>
  import("./i18n/index.js").then((module) => ({ default: module.CustomFieldsUiMessagesProvider }))

export function createSelectedCustomFieldsAdminExtension(
  _context: SelectedAdminExtensionFactoryContext,
): AdminExtension {
  return defineAdminExtension({
    id: "custom-fields",
    settingsPages: [
      {
        id: "custom-fields",
        path: "/custom-fields",
        title: customFieldsUiEn.navigation.title,
        label: customFieldsUiEn.navigation.label,
        icon: SlidersHorizontal,
        group: "general",
        order: 75,
        ssr: "data-only",
        page: () =>
          import("./components/custom-field-definitions-page.js").then((module) =>
            adminRoutePageModule(module.CustomFieldDefinitionsPage),
          ),
        routeMessagesProvider: customFieldsRouteMessagesProvider,
      },
    ],
  })
}
