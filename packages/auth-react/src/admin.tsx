import {
  type AdminExtension,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyant-travel/admin/extensions"
import { Users } from "lucide-react"

/** Selected-graph team settings contribution owned by Auth React. */
export function createSelectedAuthTeamAdminExtension(): AdminExtension {
  return defineAdminExtension({
    id: "auth-team",
    settingsPages: [
      {
        id: "team",
        path: "/team",
        title: "Team",
        label: "Team",
        icon: Users,
        group: "general",
        order: 20,
        page: () =>
          import("./components/team-management-page.js").then((module) =>
            adminRoutePageModule(module.TeamManagementPage),
          ),
        routeMessagesProvider: () =>
          import("./i18n/index.js").then((module) => ({ default: module.AuthUiMessagesProvider })),
      },
    ],
  })
}
