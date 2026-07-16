import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
  defineAdminExtension,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin/extensions"
import { Users } from "lucide-react"
import { authTeamSetupMessageDefinitions } from "./i18n/setup.js"

/** Selected-graph team settings contribution owned by Auth React. */
export function createSelectedAuthTeamAdminExtension(
  context?: SelectedAdminExtensionFactoryContext,
): AdminExtension {
  const label = context?.navMessages.team ?? authTeamSetupMessageDefinitions.en.navigationLabel
  return defineAdminExtension({
    id: "auth-team",
    settingsPages: [
      {
        id: "team",
        path: "/team",
        title: label,
        label,
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
    setupSteps: [
      {
        id: "@voyant-travel/auth#setup.team",
        order: 60,
        skippable: true,
        href: "/settings/team",
        messages: authTeamSetupMessageDefinitions,
        isComplete: hasAdditionalTeamMember,
      },
    ],
  })
}

async function hasAdditionalTeamMember({ runtime }: AdminRouteLoaderContext): Promise<boolean> {
  const fetcher = runtime.fetcher ?? fetch
  const [membersResponse, invitationsResponse] = await Promise.all([
    fetcher(`${runtime.baseUrl}/v1/admin/team/members`),
    fetcher(`${runtime.baseUrl}/v1/admin/team/invitations`),
  ])
  if (!membersResponse.ok || !invitationsResponse.ok) return false
  const members = (await membersResponse.json()) as { data?: unknown[] }
  const invitations = (await invitationsResponse.json()) as { data?: unknown[] }
  return (members.data?.length ?? 0) > 1 || (invitations.data?.length ?? 0) > 0
}
