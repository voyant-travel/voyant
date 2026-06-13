import { describe, expect, it, vi } from "vitest"
import { adminRootHead } from "../../src/app/root.js"
import { createAdminQueryClient } from "../../src/app/router.js"
import {
  createAdminWorkspaceBeforeLoad,
  defaultAdminWorkspaceUser,
} from "../../src/app/workspace.js"

describe("createAdminQueryClient", () => {
  it("applies the admin defaults", () => {
    const queryClient = createAdminQueryClient()
    const defaults = queryClient.getDefaultOptions()

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
    expect(defaults.queries?.retry).toBe(1)
    expect(defaults.queries?.staleTime).toBe(30_000)
  })
})

describe("adminRootHead", () => {
  it("emits title, og tags, favicon, and the bootstrap script", () => {
    const head = adminRootHead({ title: "Acme Admin", description: "Acme workspace" })

    expect(head.meta).toContainEqual({ title: "Acme Admin" })
    expect(head.meta).toContainEqual({ property: "og:title", content: "Acme Admin" })
    expect(head.meta).toContainEqual({ name: "description", content: "Acme workspace" })
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex,nofollow" })
    expect(head.links).toContainEqual({ rel: "icon", type: "image/png", href: "/fav128.png" })
    const script = head.scripts[0]?.children ?? ""
    expect(script).toContain('localStorage.getItem("theme")')
    expect(script).toContain('localStorage.getItem("admin-locale")')
  })

  it("supports custom favicon and extra meta/links", () => {
    const head = adminRootHead({
      title: "Acme",
      faviconHref: "/acme.png",
      meta: [{ name: "x-custom", content: "1" }],
      links: [{ rel: "manifest", href: "/manifest.json" }],
    })

    expect(head.links).toContainEqual({ rel: "icon", type: "image/png", href: "/acme.png" })
    expect(head.meta).toContainEqual({ name: "x-custom", content: "1" })
    expect(head.links).toContainEqual({ rel: "manifest", href: "/manifest.json" })
  })

  it("omits the description meta when not provided", () => {
    const head = adminRootHead({ title: "Acme" })

    expect(head.meta.some((tag) => "name" in tag && tag.name === "description")).toBe(false)
  })
})

describe("createAdminWorkspaceBeforeLoad", () => {
  it("returns the user in route context when authenticated", async () => {
    const user = { id: "usr_1" }
    const beforeLoad = createAdminWorkspaceBeforeLoad({ getCurrentUser: async () => user })

    await expect(beforeLoad({ location: { href: "/bookings" } })).resolves.toEqual({ user })
  })

  it("redirects unauthenticated visitors to sign-in with a next param", async () => {
    const beforeLoad = createAdminWorkspaceBeforeLoad({ getCurrentUser: async () => null })

    const thrown = await beforeLoad({ location: { href: "/bookings?tab=upcoming" } }).then(
      () => undefined,
      (error: unknown) => error,
    )

    expect(thrown).toBeDefined()
    const options = (thrown as { options?: { to?: string; search?: { next?: string } } }).options
    expect(options?.to).toBe("/sign-in")
    expect(options?.search?.next).toBe("/bookings?tab=upcoming")
  })

  it("honors a custom sign-in path", async () => {
    const getCurrentUser = vi.fn(async () => undefined)
    const beforeLoad = createAdminWorkspaceBeforeLoad({ getCurrentUser, signInPath: "/login" })

    const thrown = await beforeLoad({ location: { href: "/" } }).then(
      () => undefined,
      (error: unknown) => error,
    )

    const options = (thrown as { options?: { to?: string } }).options
    expect(options?.to).toBe("/login")
  })
})

describe("defaultAdminWorkspaceUser", () => {
  it("maps the common user fields", () => {
    expect(
      defaultAdminWorkspaceUser({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.test",
        profilePictureUrl: "/ada.png",
        locale: "en",
        timezone: "Europe/Bucharest",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.test",
      avatar: "/ada.png",
      locale: "en",
      timeZone: "Europe/Bucharest",
    })
  })

  it("prefers timeZone over timezone and tolerates missing fields", () => {
    const mapped = defaultAdminWorkspaceUser({
      firstName: "Ada",
      timeZone: "UTC",
      timezone: "Europe/Bucharest",
    })

    expect(mapped.name).toBe("Ada")
    expect(mapped.timeZone).toBe("UTC")
    // AdminUser.email is a required string — missing email maps to "".
    expect(mapped.email).toBe("")
  })
})

describe("attachAdminExtensionRoutes", () => {
  it("grafts extension routes under the parent and is idempotent by path", async () => {
    const { createRootRoute, createRoute } = await import("@tanstack/react-router")
    const { attachAdminExtensionRoutes } = await import("../../src/app/extension-routes.js")

    const rootRoute = createRootRoute()
    const layout = createRoute({ getParentRoute: () => rootRoute, id: "workspace" })
    const fileChild = createRoute({ getParentRoute: () => layout, path: "/settings" })
    layout.addChildren([fileChild])
    const tree = rootRoute.addChildren([layout])

    const extensionRoute = createRoute({ getParentRoute: () => layout, path: "/bookings" })
    const result = attachAdminExtensionRoutes(tree, layout, [extensionRoute])
    expect(result).toBe(tree)
    expect(layout.children).toHaveLength(2)

    // Re-evaluation (dev-server module reload) replaces by path, never duplicates.
    const reloadedRoute = createRoute({ getParentRoute: () => layout, path: "/bookings" })
    attachAdminExtensionRoutes(tree, layout, [reloadedRoute])
    const children = layout.children as Array<{ options: { path?: string } }>
    expect(children).toHaveLength(2)
    expect(children.filter((child) => child.options.path === "/bookings")).toHaveLength(1)
  })
})

describe("adminExtensionRouteOptions", () => {
  it("binds contribution loader/ssr/boundaries and resolves the runtime per call", async () => {
    const { adminExtensionRouteOptions } = await import("../../src/app/extension-routes.js")
    const loader = vi.fn()
    const extension = {
      id: "demo",
      routes: [
        {
          id: "demo-index",
          path: "/demo",
          title: "Demo",
          ssr: "data-only" as const,
          page: () => Promise.resolve({ default: () => null }),
          loader,
        },
      ],
    }

    const options = adminExtensionRouteOptions(extension, "demo-index", () => ({
      baseUrl: "https://api.test",
    }))
    expect(options.ssr).toBe("data-only")
    expect(options.wrapInSuspense).toBe(true)
    expect(typeof options.component).toBe("function")

    const queryClient = createAdminQueryClient()
    options.loader({ context: { queryClient }, params: { id: "x" } })
    expect(loader).toHaveBeenCalledWith({
      queryClient,
      runtime: { baseUrl: "https://api.test" },
      params: { id: "x" },
    })
  })

  it("throws loudly when the contribution has no implementation", async () => {
    const { adminExtensionRouteOptions } = await import("../../src/app/extension-routes.js")
    expect(() =>
      adminExtensionRouteOptions(
        { id: "demo", routes: [{ id: "bare", path: "/bare", title: "Bare" }] },
        "bare",
        { baseUrl: "x" },
      ),
    ).toThrow(/carries no/)
  })
})

describe("adminExtensionRouteOptions (redirect contributions)", async () => {
  const { adminExtensionRouteOptions } = await import("../../src/app/extension-routes.js")
  const { defineAdminExtension } = await import("@voyantjs/admin")

  const extension = defineAdminExtension({
    id: "catalog",
    routes: [
      { id: "catalog-index", path: "/catalog", title: "Catalog", redirectTo: "/catalog/products" },
    ],
  })

  it("emits a beforeLoad that throws the router redirect", () => {
    const options = adminExtensionRouteOptions(extension, "catalog-index", { baseUrl: "/api" })

    expect(options.component).toBeUndefined()
    expect(options.beforeLoad).toBeDefined()
    let thrown: unknown
    try {
      options.beforeLoad?.()
    } catch (error) {
      thrown = error
    }
    const redirectOptions = (thrown as { options?: { to?: string; replace?: boolean } }).options
    expect(redirectOptions?.to).toBe("/catalog/products")
    expect(redirectOptions?.replace).toBe(true)
  })

  it("omits beforeLoad for page contributions", async () => {
    const { createAdminCoreExtension } = await import("../../src/app/core-extension/index.js")
    const core = createAdminCoreExtension()
    const options = adminExtensionRouteOptions(core, "core-dashboard", { baseUrl: "/api" })

    expect(options.beforeLoad).toBeUndefined()
    expect(options.component).toBeDefined()
  })
})

describe("createAdminCoreExtension", async () => {
  const { createAdminCoreExtension } = await import("../../src/app/core-extension/index.js")
  const { adminExtensionChildRoutes } = await import("../../src/app/extension-routes.js")
  const { createRootRoute } = await import("@tanstack/react-router")

  it("ships dashboard, account, and the settings tree by default", () => {
    const core = createAdminCoreExtension()

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
      "core-settings-team",
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
    const core = createAdminCoreExtension({
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
    // With channels omitted, the index redirect falls back to the first
    // remaining built-in page.
    expect(settings?.children?.[0]?.redirectTo).toBe("/settings/team")
  })

  it("binds app-supplied extra settings pages as child contributions", () => {
    const core = createAdminCoreExtension({
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
          "/team",
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
