import { describe, expect, it } from "vitest"
import { compileAppManifest } from "./compiler.js"
import { appManifestSchema } from "./contracts.js"
import { validManifest } from "./test-fixtures.js"

describe("app manifest compiler", () => {
  it("accepts a closed v1 manifest and produces a stable digest", () => {
    const first = compileAppManifest(validManifest)
    const second = compileAppManifest({
      ...validManifest,
      scopes: { optional: ["invoices:read"], requested: ["bookings:read"] },
    })

    expect(first.digest).toMatch(/^sha256:/)
    expect(second.digest).toBe(first.digest)
    expect(first.normalizedRelease.defaultLocale).toBe("en-US")
    expect(first.normalizedRelease.localizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: "en-US", surface: "app", messageKey: "name" }),
        expect.objectContaining({
          locale: "en-US",
          surface: "extension",
          messageKey: "booking-panel",
        }),
      ]),
    )
  })

  it("rejects forbidden declaration classes with actionable paths", () => {
    const result = appManifestSchema.safeParse({
      ...validManifest,
      migrations: ["001.sql"],
      providers: [{ role: "database" }],
      scripts: { postinstall: "node install.js" },
      dependencies: { leftpad: "1.0.0" },
      exports: { ".": "./index.js" },
      files: ["dist/index.js"],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["migrations", "providers", "scripts", "dependencies", "exports"]),
      )
      expect(result.error.issues.map((issue) => issue.message).join("\n")).toContain("forbidden")
    }
  })

  it("validates slot ids and external webhook event versions", () => {
    expect(() =>
      compileAppManifest({
        ...validManifest,
        admin: {
          ...validManifest.admin,
          slotExtensions: [{ ...validManifest.admin.slotExtensions[0], slots: ["unknown.slot"] }],
        },
      }),
    ).toThrow()

    expect(() =>
      compileAppManifest(validManifest, {
        eventCatalog: {
          schemaVersion: "voyant.event-catalog.v1",
          events: [
            {
              key: "booking.created@2.0.0",
              id: "event.booking.created",
              unitId: "@voyant-travel/bookings",
              packageName: "@voyant-travel/bookings",
              eventType: "booking.created",
              version: "2.0.0",
              payloadSchema: { type: "object", properties: {} },
              visibility: "external",
              audit: { sourceModule: "@voyant-travel/bookings", category: "domain" },
              redactedFields: [],
            },
          ],
        },
      }),
    ).toThrow(/not an external event contract/)
  })
})
