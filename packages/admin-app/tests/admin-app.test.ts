import { describe, expect, it } from "vitest"

import { createAdminCoreExtension as createAdminCoreExtensionShim } from "../src/core-extension/index.js"
import { adminRootHead as adminRootHeadShim } from "../src/root.js"
import { createAdminQueryClient as createAdminQueryClientShim } from "../src/router.js"
import { createAdminWorkspaceBeforeLoad as createAdminWorkspaceBeforeLoadShim } from "../src/workspace.js"

describe("@voyant-travel/admin-app compatibility exports", () => {
  it("re-exports the admin app shell surface", async () => {
    const { adminRootHead } = await import("@voyant-travel/admin/app/root")
    const { createAdminQueryClient } = await import("@voyant-travel/admin/app/router")
    const { createAdminWorkspaceBeforeLoad } = await import("@voyant-travel/admin/app/workspace")

    expect(adminRootHeadShim).toBe(adminRootHead)
    expect(createAdminQueryClientShim).toBe(createAdminQueryClient)
    expect(createAdminWorkspaceBeforeLoadShim).toBe(createAdminWorkspaceBeforeLoad)
  })

  it("exports the domain-backed core extension from admin-app", async () => {
    const { createAdminCoreExtension } = await import("../src/index.js")

    expect(createAdminCoreExtension).toBe(createAdminCoreExtensionShim)
  })
})

describe("createAdminCoreExtension", async () => {
  const { adminExtensionChildRoutes } = await import("@voyant-travel/admin/app/extension-routes")
  const { createRootRoute } = await import("@tanstack/react-router")

  it("ships dashboard, account, and the settings tree by default", () => {
    const core = createAdminCoreExtensionShim()

    expect(core.id).toBe("core")
    expect(core.routes?.map((route) => route.id)).toEqual([
      "core-dashboard",
      "core-account",
      "core-settings",
    ])
    const settings = core.routes?.find((route) => route.id === "core-settings")
    expect(settings?.path).toBe("/settings")
    expect(settings?.children?.map((child) => child.id)).toEqual([
      "core-settings-index",
      "core-settings-api-tokens",
      "core-settings-channels",
      "core-settings-taxes",
      "core-settings-cost-categories",
      "core-settings-pricing-categories",
      "core-settings-price-catalogs",
      "core-settings-product-types",
      "core-settings-product-tags",
    ])
    expect(settings?.children?.[0]?.redirectTo).toBe("/settings/channels")
    expect(core.navigation).toBeUndefined()
  })

  it("supports disabling surfaces and omitting built-in settings pages", () => {
    const core = createAdminCoreExtensionShim({
      dashboard: false,
      account: false,
      settings: { omit: ["channels", "product-tags"] },
    })

    expect(core.routes?.map((route) => route.id)).toEqual(["core-settings"])
    const settings = core.routes?.find((route) => route.id === "core-settings")
    expect(settings?.children?.some((child) => child.id === "core-settings-channels")).toBe(false)
    expect(settings?.children?.some((child) => child.id === "core-settings-product-tags")).toBe(
      false,
    )
    expect(settings?.children?.[0]?.redirectTo).toBe("/settings/api-tokens")
  })

  it("binds app-supplied extra settings pages as child contributions", () => {
    const core = createAdminCoreExtensionShim({
      settings: {
        extraPages: [
          {
            id: "operator",
            path: "/operator",
            title: "Operator Profile",
            page: () => Promise.resolve({ default: () => null }),
          },
        ],
      },
    })

    const settings = core.routes?.find((route) => route.id === "core-settings")
    const extra = settings?.children?.find((child) => child.id === "core-settings-operator")
    expect(extra?.path).toBe("/operator")

    const rootRoute = createRootRoute()
    const childRoutes = adminExtensionChildRoutes(
      core,
      "core-settings",
      () => rootRoute,
      { baseUrl: "/api" },
      {
        exclude: [
          "/",
          "/api-tokens",
          "/channels",
          "/taxes",
          "/cost-categories",
          "/pricing-categories",
          "/price-catalogs",
          "/product-types",
          "/product-tags",
        ],
      },
    )
    expect(childRoutes.map((route) => (route.options as { path?: string }).path)).toEqual([
      "/operator",
    ])
  })
})
