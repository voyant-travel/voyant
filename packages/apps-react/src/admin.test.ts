import { describe, expect, it } from "vitest"
import { createAppsAdminExtension } from "./admin.js"

describe("apps admin extension", () => {
  it("registers a browser-facing OAuth authorization page", () => {
    const extension = createAppsAdminExtension()
    expect(extension.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "apps-oauth-authorize",
          path: "/apps/oauth/authorize",
          capability: "apps:write",
        }),
      ]),
    )
  })
})
