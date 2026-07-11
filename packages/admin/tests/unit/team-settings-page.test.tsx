import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { memberPermissionGroups } from "../../src/components/team-settings-cloud.js"
import {
  TeamSettingsPage,
  type TeamSettingsPageApi,
} from "../../src/components/team-settings-page.js"
import { AdminProvider } from "../../src/providers/admin-provider.js"
import { OperatorAdminMessagesProvider } from "../../src/providers/operator-admin-messages.js"

describe("TeamSettingsPage", () => {
  it("renders with a custom API without requiring VoyantReactProvider", () => {
    const api: TeamSettingsPageApi = {
      get: async () => ({ data: [] }),
      post: async () => ({ data: null }),
      delete: async () => undefined,
    }

    const html = renderToStaticMarkup(
      <AdminProvider
        defaultTheme="light"
        themeStorageKey={null}
        localeStorageKey={null}
        timeZoneStorageKey={null}
      >
        <OperatorAdminMessagesProvider>
          <TeamSettingsPage api={api} />
        </OperatorAdminMessagesProvider>
      </AdminProvider>,
    )

    expect(html).toContain("Team")
  })

  it("uses selected resource descriptors in the member permission editor", () => {
    const groups = memberPermissionGroups({
      resources: [
        {
          id: "bookings",
          unitId: "@voyant-travel/bookings",
          resource: "bookings",
          label: "Selected Bookings",
          description: "Selected",
          wildcard: "allow",
          actions: [{ action: "read", label: "Selected read", description: "Read" }],
        },
      ],
      presets: [],
    })

    expect(groups.filter((group) => group.resource === "bookings")).toEqual([
      expect.objectContaining({
        label: "Selected Bookings",
        permissions: [expect.objectContaining({ action: "read", label: "Selected read" })],
      }),
    ])
  })
})
