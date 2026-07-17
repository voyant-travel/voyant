import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { describe, expect, it } from "vitest"
import { computeAppConsent } from "./consent.js"
import type { AppRelease } from "./schema.js"

const catalog: AccessCatalog = {
  resources: [
    {
      id: "bookings",
      unitId: "bookings",
      resource: "bookings",
      label: "Bookings",
      description: "Bookings",
      wildcard: "allow",
      actions: [{ action: "read", label: "Read", description: "Read" }],
    },
    {
      id: "invoices",
      unitId: "finance",
      resource: "invoices",
      label: "Invoices",
      description: "Invoices",
      wildcard: "allow",
      actions: [{ action: "read", label: "Read", description: "Read" }],
    },
  ],
  presets: [
    {
      id: "remote-safe",
      kind: "api-token-grant",
      audience: "staff",
      label: "Remote safe",
      description: "Remote app grants",
      grants: ["bookings:read"],
    },
  ],
}

function release(requestedScopes: string[], optionalScopes: string[]): AppRelease {
  return {
    id: "release_1",
    appId: "app_1",
    releaseVersion: "1.0.0",
    manifestSchemaVersion: "voyant.app-manifest.v1",
    manifestDigest: "digest",
    manifestSnapshot: {},
    normalizedRecord: {
      schemaVersion: "voyant.app-release.normalized.v1",
      releaseVersion: "1.0.0",
      digest: "digest",
      requestedScopes,
      optionalScopes,
      adminPages: [],
      slotExtensions: [],
      webhooks: [],
      customFields: [],
    },
    apiCompatibility: { min: "2026-01-01", max: "2026-12-31" },
    defaultLocale: "en-US",
    supportedLocales: ["en-US"],
    state: "available",
    createdBy: "user_1",
    createdAt: new Date(),
  }
}

describe("app OAuth consent computation", () => {
  it("grants only scopes present in the catalog, remote-safe, and operator-granted", () => {
    const consent = computeAppConsent({
      release: release(["bookings:read"], ["invoices:read"]),
      accessCatalog: catalog,
      operatorGrantedScopes: ["bookings:read", "invoices:read"],
      grantedOptionalScopes: ["invoices:read"],
    })

    expect(consent.grantedScopes).toEqual(["bookings:read"])
    expect(consent.deniedOptionalScopes).toEqual(["invoices:read"])
  })

  it("rejects required scopes that are absent, unsafe, or not operator-granted", () => {
    expect(() =>
      computeAppConsent({
        release: release(["invoices:read"], []),
        accessCatalog: catalog,
        operatorGrantedScopes: ["invoices:read"],
      }),
    ).toThrow("Required app scopes are not grantable")
  })
})
