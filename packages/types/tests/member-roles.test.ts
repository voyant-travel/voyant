import { describe, expect, it } from "vitest"

import { hasApiKeyPermission, permissionStringsToPermissions } from "../src/api-keys.js"
import {
  accessCatalogScopesForRole,
  isFullAccessRole,
  MEMBER_ROLE_PRESETS,
  permissionsForRole,
  scopesForRole,
} from "../src/member-roles.js"

const teamAccessCatalog = {
  resources: [
    {
      id: "@voyant-travel/auth#access.team",
      unitId: "@voyant-travel/auth#team",
      resource: "team",
      label: "Team",
      description: "Manage staff team members and their access.",
      wildcard: "explicit-resource",
      actions: [
        {
          action: "read",
          label: "View team",
          description: "View staff team members.",
        },
        {
          action: "write",
          label: "Manage team",
          description: "Invite staff and update roles or access.",
          wildcard: "explicit",
        },
        {
          action: "delete",
          label: "Remove team access",
          description: "Revoke invitations or deactivate staff team members.",
          wildcard: "explicit",
        },
      ],
    },
  ],
  presets: [],
} as const

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

describe("accessCatalogScopesForRole", () => {
  it("expands admin roles with explicit catalog grants for managed-cloud sessions", () => {
    const scopes = accessCatalogScopesForRole("admin", teamAccessCatalog)
    const permissions = permissionStringsToPermissions(scopes ?? [])

    expect(scopes).toEqual(["*", "team:delete", "team:read", "team:write"])
    expect(hasApiKeyPermission(permissions, "team", "read", teamAccessCatalog)).toBe(true)
    expect(hasApiKeyPermission(permissions, "team", "write", teamAccessCatalog)).toBe(true)
    expect(
      hasApiKeyPermission(permissionStringsToPermissions(["*"]), "team", "read", teamAccessCatalog),
    ).toBe(false)
  })

  it("does not add team-management grants to non-admin managed-cloud roles", () => {
    const scopes = accessCatalogScopesForRole("member", teamAccessCatalog) ?? []
    const permissions = permissionStringsToPermissions(scopes)

    expect(hasApiKeyPermission(permissions, "team", "write", teamAccessCatalog)).toBe(false)
    expect(scopes).not.toContain("team:write")
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
