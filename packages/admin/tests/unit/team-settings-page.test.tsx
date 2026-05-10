import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

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
})
