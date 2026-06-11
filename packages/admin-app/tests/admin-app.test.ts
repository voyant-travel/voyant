import { describe, expect, it, vi } from "vitest"
import { adminRootHead } from "../src/root.js"
import { createAdminQueryClient } from "../src/router.js"
import { createAdminWorkspaceBeforeLoad, defaultAdminWorkspaceUser } from "../src/workspace.js"

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
