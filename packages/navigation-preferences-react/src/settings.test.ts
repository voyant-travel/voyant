import { describe, expect, it, vi } from "vitest"

import { createSelectedNavigationPreferencesAdminExtension } from "./settings.js"

describe("navigation preferences admin contribution", () => {
  it("contributes the final-stage loader and settings page", async () => {
    const extension = createSelectedNavigationPreferencesAdminExtension()
    const fetcher = vi.fn(async () =>
      Response.json({
        data: {
          organization: { finance: false, future: true },
          member: { finance: true },
          effective: { finance: true, future: true },
          canManageOrganization: true,
        },
      }),
    )

    expect(extension.settingsPages?.[0]).toMatchObject({
      id: "navigation",
      path: "/navigation",
    })
    expect(extension.setupSteps?.[0]).toMatchObject({
      id: "@voyant-travel/navigation-preferences#setup.organization-navigation",
      href: "/settings/navigation",
    })
    await expect(
      extension.navigationPreferences?.load({ baseUrl: "/api", fetcher }),
    ).resolves.toEqual({
      organization: { finance: false, future: true },
      member: { finance: true },
      effective: { finance: true, future: true },
      canManageOrganization: true,
    })
    expect(fetcher).toHaveBeenCalledWith("/api/v1/admin/navigation-preferences")
  })
})
