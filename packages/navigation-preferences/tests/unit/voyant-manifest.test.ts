import { describe, expect, it } from "vitest"

import navigationPreferencesVoyantModule from "../../src/voyant.js"

describe("navigation preferences manifest", () => {
  it("owns its API, schema, migrations, access, and admin settings contribution", () => {
    expect(navigationPreferencesVoyantModule.id).toBe("@voyant-travel/navigation-preferences")
    expect(navigationPreferencesVoyantModule.api?.map((entry) => entry.id)).toEqual([
      "@voyant-travel/navigation-preferences#api.admin",
    ])
    expect(navigationPreferencesVoyantModule.schema).toHaveLength(1)
    expect(navigationPreferencesVoyantModule.migrations).toHaveLength(1)
    expect(navigationPreferencesVoyantModule.api?.[0]).toMatchObject({
      resource: "admin-navigation",
      authorization: "route",
    })
    expect(navigationPreferencesVoyantModule.access?.resources[0]?.resource).toBe(
      "admin-navigation",
    )
    expect(navigationPreferencesVoyantModule.admin?.routes[0]?.path).toBe("/settings/navigation")
  })
})
