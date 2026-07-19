import { describe, expect, it } from "vitest"
import { compileAppManifest } from "./compiler.js"
import { appManifestSchema } from "./contracts.js"
import { validManifest } from "./test-fixtures.js"

describe("app manifest compiler", () => {
  it("accepts truthful disclosure of publisher-custodied encrypted secrets", () => {
    const parsed = appManifestSchema.parse({
      ...validManifest,
      data: { ...validManifest.data, storesSecrets: true },
    })
    expect(parsed.data.storesSecrets).toBe(true)
  })

  it("admits an explicit HTTPS managed lifecycle endpoint", () => {
    const parsed = appManifestSchema.parse({
      ...validManifest,
      urls: { ...validManifest.urls, lifecycle: "https://app.example.com/lifecycle" },
    })
    expect(parsed.urls.lifecycle).toBe("https://app.example.com/lifecycle")
    expect(() =>
      appManifestSchema.parse({
        ...validManifest,
        urls: { ...validManifest.urls, lifecycle: "http://app.example.com/lifecycle" },
      }),
    ).toThrow(/https/i)
  })

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

    expect(() =>
      compileAppManifest(validManifest, {
        eventCatalog: {
          schemaVersion: "voyant.event-catalog.v1",
          events: [
            {
              key: "booking.created@1.0.0",
              id: "event.booking.created",
              unitId: "@voyant-travel/bookings",
              packageName: "@voyant-travel/bookings",
              eventType: "booking.created",
              version: "1.0.0",
              payloadSchema: { type: "object", properties: {} },
              visibility: "internal",
              audit: { sourceModule: "@voyant-travel/bookings", category: "domain" },
              redactedFields: [],
            },
          ],
        },
      }),
    ).toThrow(/not an external event contract/)
  })

  it("accepts an HTTPS per-page nav icon and rejects a non-HTTPS one", () => {
    const parsed = appManifestSchema.parse({
      ...validManifest,
      admin: {
        ...validManifest.admin,
        pages: [{ ...validManifest.admin.pages[0], icon: "https://app.example.com/icon.svg" }],
      },
    })
    expect(parsed.admin.pages[0]?.icon).toBe("https://app.example.com/icon.svg")

    expect(() =>
      appManifestSchema.parse({
        ...validManifest,
        admin: {
          ...validManifest.admin,
          pages: [{ ...validManifest.admin.pages[0], icon: "http://app.example.com/icon.svg" }],
        },
      }),
    ).toThrow(/https/i)
  })

  it("resolves the app-level default icon into pages that omit their own", () => {
    const normalized = compileAppManifest({
      ...validManifest,
      icon: "https://app.example.com/app-icon.svg",
      admin: {
        ...validManifest.admin,
        pages: [
          {
            key: "inherits",
            titleKey: "t",
            path: "/inherits",
            entryUrl: "https://app.example.com/a",
          },
          {
            key: "owns",
            titleKey: "t",
            path: "/owns",
            entryUrl: "https://app.example.com/b",
            icon: "https://app.example.com/own-icon.svg",
          },
        ],
      },
    }).normalizedRelease
    const byKey = new Map(normalized.adminPages.map((page) => [page.key, page.icon]))
    expect(byKey.get("inherits")).toBe("https://app.example.com/app-icon.svg")
    expect(byKey.get("owns")).toBe("https://app.example.com/own-icon.svg")
  })

  it("leaves pages without an icon when neither the page nor the app declares one", () => {
    const normalized = compileAppManifest(validManifest).normalizedRelease
    expect(normalized.adminPages[0]?.icon).toBeUndefined()
  })

  it("rejects webhook endpoints that target local infrastructure", () => {
    expect(() =>
      compileAppManifest({
        ...validManifest,
        webhooks: [
          {
            eventType: "booking.created",
            eventVersion: "1.0.0",
            endpointUrl: "https://127.0.0.1/webhooks/voyant",
          },
        ],
      }),
    ).toThrow(/local or private hosts/)
  })
})
