import { describe, expect, it } from "vitest"

import { API_KEY_PERMISSION_GROUPS, API_KEY_RESOURCES } from "../src/api-keys.js"

describe("API key permission catalog", () => {
  it("exposes quotes and trips as grantable read/write resources", () => {
    expect(API_KEY_RESOURCES).toContain("quotes")
    expect(API_KEY_RESOURCES).toContain("trips")

    for (const resource of ["quotes", "trips"]) {
      const group = API_KEY_PERMISSION_GROUPS.find((item) => item.resource === resource)

      expect(group?.permissions.map((permission) => permission.action).sort()).toEqual([
        "read",
        "write",
      ])
    }
  })
})
