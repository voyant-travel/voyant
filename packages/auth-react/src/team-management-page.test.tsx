import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { createSelectedAuthTeamAdminExtension } from "./admin.js"
import { TeamManagementPage } from "./components/team-management-page.js"
import type { TeamManagementPageApi } from "./team-management-api.js"

function pageApi(): TeamManagementPageApi {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}

describe("Auth team-management admin surface", () => {
  it("owns the stable settings route, copy, and icon", () => {
    const extension = createSelectedAuthTeamAdminExtension()
    const page = extension.settingsPages?.[0]

    expect(page).toMatchObject({ id: "team", path: "/team", title: "Team", label: "Team" })
    expect(page?.icon).toBeTypeOf("object")
    expect(page?.routeMessagesProvider).toBeTypeOf("function")
  })

  it("renders neutral roster data and nullable provider activity without auth-mode discovery", () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(["team-management", "capabilities"], {
      data: {
        viewRoster: true,
        inviteMembers: false,
        manageRoles: false,
        deactivateMembers: false,
        revokeInvitations: false,
      },
    })
    queryClient.setQueryData(["team-management", "members"], {
      data: [
        {
          id: "member_1",
          email: "member@example.com",
          name: "Team Member",
          roleId: "editor",
          roleName: "Editor",
          status: "active",
          joinedAt: null,
          lastActivityAt: null,
        },
      ],
    })
    queryClient.setQueryData(["team-management", "roles"], { data: [] })
    queryClient.setQueryData(["team-management", "invitations"], { data: [] })
    const api = pageApi()

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <TeamManagementPage api={api} />
      </QueryClientProvider>,
    )

    expect(html).toContain("Team Member")
    expect(html).toContain("Not provided")
    expect(html).not.toContain("membershipId")
    expect(html).not.toContain("externalUserId")
    expect(api.get).not.toHaveBeenCalledWith("/auth/bootstrap-status")
  })
})
