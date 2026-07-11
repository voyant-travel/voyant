import { describe, expect, it } from "vitest"

import { hasApiKeyPermission } from "../src/api-keys.js"
import {
  isFullAccessRole,
  MEMBER_ROLE_PRESETS,
  permissionsForRole,
  scopesForRole,
} from "../src/member-roles.js"

describe("permissionsForRole", () => {
  it("maps owner/admin/super-admin to full access", () => {
    for (const role of ["owner", "admin", "super-admin", "ADMIN", " Admin "]) {
      expect(permissionsForRole(role)).toEqual({ "*": ["*"] })
    }
  })

  it("maps viewer/guest to read-only", () => {
    expect(permissionsForRole("viewer")).toEqual(MEMBER_ROLE_PRESETS.viewer.permissions)
    expect(permissionsForRole("guest")).toEqual(MEMBER_ROLE_PRESETS.viewer.permissions)
  })

  it("maps editor/member to the editor bundle", () => {
    expect(permissionsForRole("editor")).toEqual(MEMBER_ROLE_PRESETS.editor.permissions)
    expect(permissionsForRole("member")).toEqual(MEMBER_ROLE_PRESETS.editor.permissions)
  })

  it("returns null for custom/unknown/empty slugs", () => {
    expect(permissionsForRole("custom")).toBeNull()
    expect(permissionsForRole("totally-unknown")).toBeNull()
    expect(permissionsForRole(null)).toBeNull()
    expect(permissionsForRole(undefined)).toBeNull()
  })
})

describe("scopesForRole", () => {
  it("resolves admin to the wildcard", () => {
    expect(scopesForRole("admin")).toEqual(["*"])
  })

  it("resolves viewer to read/search wildcards", () => {
    expect(scopesForRole("viewer")).toEqual(["*:read", "*:search"])
  })

  it("leaves Bookings grants to project-owned presets and keeps finance read-only", () => {
    const scopes = scopesForRole("editor") ?? []
    expect(scopes).not.toContain("bookings:read")
    expect(scopes).not.toContain("bookings:write")
    expect(scopes).toContain("finance:read")
    expect(scopes).not.toContain("finance:write")
    // No deletes, no team/settings in the default editor bundle.
    expect(scopes.some((s) => s.endsWith(":delete"))).toBe(false)
    expect(scopes.some((s) => s.startsWith("team:") || s.startsWith("settings:"))).toBe(false)
  })

  it("returns null for slugs without a preset", () => {
    expect(scopesForRole("custom")).toBeNull()
  })
})

describe("role bundles enforce as expected via hasApiKeyPermission", () => {
  it("admin passes every gate", () => {
    const p = permissionsForRole("admin")
    expect(hasApiKeyPermission(p, "finance", "write")).toBe(true)
    expect(hasApiKeyPermission(p, "team", "manage")).toBe(true)
  })

  it("editor leaves Bookings to project policy and cannot write finance", () => {
    const p = permissionsForRole("editor")
    expect(hasApiKeyPermission(p, "bookings", "write")).toBe(false)
    expect(hasApiKeyPermission(p, "bookings", "delete")).toBe(false)
    expect(hasApiKeyPermission(p, "finance", "read")).toBe(true)
    expect(hasApiKeyPermission(p, "finance", "write")).toBe(false)
    expect(hasApiKeyPermission(p, "team", "manage")).toBe(false)
  })

  it("viewer can read anything but write nothing", () => {
    const p = permissionsForRole("viewer")
    expect(hasApiKeyPermission(p, "bookings", "read")).toBe(true)
    expect(hasApiKeyPermission(p, "products", "read")).toBe(true)
    expect(hasApiKeyPermission(p, "bookings", "write")).toBe(false)
  })
})

describe("isFullAccessRole", () => {
  it("is true only for admin-equivalent roles", () => {
    expect(isFullAccessRole("owner")).toBe(true)
    expect(isFullAccessRole("admin")).toBe(true)
    expect(isFullAccessRole("editor")).toBe(false)
    expect(isFullAccessRole("viewer")).toBe(false)
    expect(isFullAccessRole("custom")).toBe(false)
    expect(isFullAccessRole(null)).toBe(false)
  })
})
