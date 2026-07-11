import { describe, expect, it } from "vitest"

import {
  API_KEY_GRANT_PRESETS,
  API_KEY_PERMISSION_GROUPS,
  API_KEY_RESOURCES,
  type AccessCatalog,
  areKnownPermissions,
  assertKnownPermissions,
  createEffectiveAccessCatalog,
  hasApiKeyPermission,
  UnknownApiKeyPermissionError,
} from "../src/api-keys.js"

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

  it("adds the fine-grained agent resources", () => {
    for (const resource of ["bookings-pii", "content", "media", "dashboard"]) {
      expect(API_KEY_RESOURCES).toContain(resource)
    }
  })
})

describe("PII resources are excluded from wildcard grants", () => {
  it("does not grant bookings-pii via the full-access wildcard", () => {
    expect(hasApiKeyPermission({ "*": ["*"] }, "bookings-pii", "read")).toBe(false)
    expect(hasApiKeyPermission({ "*": ["read"] }, "bookings-pii", "read")).toBe(false)
  })

  it("grants bookings-pii only when named explicitly", () => {
    expect(hasApiKeyPermission({ "bookings-pii": ["read"] }, "bookings-pii", "read")).toBe(true)
    expect(hasApiKeyPermission({ "bookings-pii": ["*"] }, "bookings-pii", "read")).toBe(true)
  })

  it("still grants non-PII resources via the wildcard", () => {
    expect(hasApiKeyPermission({ "*": ["read"] }, "bookings", "read")).toBe(true)
    expect(hasApiKeyPermission({ "*": ["*"] }, "finance", "refund")).toBe(true)
  })
})

describe("explicit-only API key permissions", () => {
  it("requires an exact notifications:send grant", () => {
    expect(hasApiKeyPermission({ "*": ["*"] }, "notifications", "send")).toBe(false)
    expect(hasApiKeyPermission({ "*": ["send"] }, "notifications", "send")).toBe(false)
    expect(hasApiKeyPermission({ notifications: ["*"] }, "notifications", "send")).toBe(false)
    expect(hasApiKeyPermission({ notifications: ["send"] }, "notifications", "send")).toBe(true)
  })

  it("still grants lower-risk notification reads through wildcards", () => {
    expect(hasApiKeyPermission({ "*": ["read"] }, "notifications", "read")).toBe(true)
    expect(hasApiKeyPermission({ notifications: ["*"] }, "notifications", "read")).toBe(true)
  })
})

describe("assertKnownPermissions", () => {
  it("accepts known resources, actions, and wildcards", () => {
    expect(() =>
      assertKnownPermissions({
        bookings: ["read", "cancel"],
        finance: ["refund", "void"],
        "*": ["read"],
      }),
    ).not.toThrow()
    expect(() => assertKnownPermissions({ catalog: ["*"] })).not.toThrow()
  })

  it("rejects an unknown resource", () => {
    expect(() => assertKnownPermissions({ bananas: ["read"] })).toThrow(
      UnknownApiKeyPermissionError,
    )
    expect(areKnownPermissions({ bananas: ["read"] })).toBe(false)
  })

  it("rejects an unknown action", () => {
    expect(() => assertKnownPermissions({ bookings: ["frobnicate"] })).toThrow(
      UnknownApiKeyPermissionError,
    )
  })

  it("rejects known actions paired with unsupported resources", () => {
    expect(() => assertKnownPermissions({ bookings: ["send"] })).toThrow(
      UnknownApiKeyPermissionError,
    )
  })

  it("validates every grant preset's permissions", () => {
    for (const preset of Object.values(API_KEY_GRANT_PRESETS)) {
      expect(() => assertKnownPermissions(preset.permissions)).not.toThrow()
      expect(["staff", "customer", "partner", "supplier"]).toContain(preset.audience)
    }
  })
})

describe("selected access catalog compatibility", () => {
  const selected: AccessCatalog = {
    resources: [
      {
        id: "bookings",
        unitId: "@voyant-travel/bookings",
        resource: "bookings",
        label: "Bookings selected",
        description: "Selected authority",
        wildcard: "allow",
        actions: [
          { action: "read", label: "Read", description: "Read" },
          { action: "write", label: "Write", description: "Write" },
        ],
        legacyActions: ["cancel"],
      },
    ],
    presets: [],
  }
  const effective = createEffectiveAccessCatalog(selected)

  it("lets selected resources replace legacy descriptors without shadowing", () => {
    expect(effective.resources.find((resource) => resource.resource === "bookings")?.label).toBe(
      "Bookings selected",
    )
    expect(effective.resources.filter((resource) => resource.resource === "bookings")).toHaveLength(
      1,
    )
    expect(effective.resources.some((resource) => resource.resource === "finance")).toBe(true)
  })

  it("accepts legacy bookings:cancel without advertising it", () => {
    expect(() => assertKnownPermissions({ bookings: ["cancel"] }, effective)).not.toThrow()
    expect(
      effective.resources
        .find((resource) => resource.resource === "bookings")
        ?.actions.some((action) => action.action === "cancel"),
    ).toBe(false)
  })
})
