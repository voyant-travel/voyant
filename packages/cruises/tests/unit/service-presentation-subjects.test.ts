import { beforeEach, describe, expect, it, vi } from "vitest"

const catalogMocks = vi.hoisted(() => ({
  fetchOverlaysForEntity: vi.fn(async () => []),
  readSourcedEntry: vi.fn(async () => null),
  writeOverlay: vi.fn(async (_db: unknown, input: unknown) => input),
}))

vi.mock("@voyant-travel/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@voyant-travel/catalog")>()),
  ...catalogMocks,
}))

import {
  assertOverlayableShipValue,
  projectEffectiveCruiseShipReference,
  projectionReferencesCruiseShip,
  resolveCruiseShipEffectiveLocale,
  writeCruiseShipOverlay,
} from "../../src/service-presentation-subjects.js"

const validShip = {
  id: "crsh_123",
  name: "Source ship",
  slug: "source-ship",
  shipType: "ocean",
  description: "Source description",
  gallery: [],
  amenities: {},
  deckPlanUrl: null,
  capacityGuests: 100,
  capacityCrew: 20,
  cabinCount: 50,
  deckCount: 5,
  lengthMeters: "100.00",
  cruisingSpeedKnots: "20.00",
  yearBuilt: 2020,
  yearRefurbished: null,
  imo: null,
  isActive: true,
}

function shipDb(row = validShip) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [row]) })),
      })),
    })),
  }
}

describe("cruise ship editorial overlay validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    catalogMocks.fetchOverlaysForEntity.mockResolvedValue([])
    catalogMocks.readSourcedEntry.mockResolvedValue(null)
  })

  it("validates each overlay value before persistence", () => {
    expect(() => assertOverlayableShipValue("name", "")).toThrow(/invalid/i)
    expect(() => assertOverlayableShipValue("gallery", [""])).toThrow(/invalid/i)
    expect(() => assertOverlayableShipValue("deckPlanUrl", "not a url")).toThrow(/invalid/i)
    expect(catalogMocks.writeOverlay).not.toHaveBeenCalled()
  })

  it("validates the complete effective ship before persistence", async () => {
    const db = shipDb({ ...validShip, name: "" })

    await expect(
      writeCruiseShipOverlay(db as never, "crsh_123", {
        field_path: "description",
        scope: { locale: "ro-RO", audience: "customer", market: "RO" },
        value: "Descriere",
        origin: { kind: "admin-ui", user_id: "usr_editor" },
      }),
    ).rejects.toThrow(/failed validation/i)
    expect(catalogMocks.writeOverlay).not.toHaveBeenCalled()
  })

  it("requires the default locale for nonlocalized presentation fields", async () => {
    await expect(
      writeCruiseShipOverlay(shipDb() as never, "crsh_123", {
        field_path: "gallery",
        scope: { locale: "ro-RO", audience: "customer", market: "RO" },
        value: ["https://example.com/ship.jpg"],
        origin: { kind: "admin-ui", user_id: "usr_editor" },
      }),
    ).rejects.toThrow(/locale=default/i)
    expect(catalogMocks.writeOverlay).not.toHaveBeenCalled()
  })
})

describe("cruise ship locale and referencing-document projection", () => {
  it("recognizes provider references in discovery and sourced-content projections", () => {
    const candidates = new Set(["crsh_subject", "provider-ship-7", "crus_sr_encoded"])

    expect(projectionReferencesCruiseShip({ defaultShipId: "provider-ship-7" }, candidates)).toBe(
      true,
    )
    expect(projectionReferencesCruiseShip({ ship: { id: "crus_sr_encoded" } }, candidates)).toBe(
      true,
    )
    expect(projectionReferencesCruiseShip({ ship: { id: "another-ship" } }, candidates)).toBe(false)
  })

  it("reports fallback-chain when a requested-locale overlay replaces fallback source", () => {
    const locale = resolveCruiseShipEffectiveLocale(
      "ro-RO",
      "en-GB",
      new Map([["name", "Source ship"]]),
      {
        values: new Map([["name", "Nava"]]),
        hidden: new Set(),
        provenance: new Map([["name", { locale: "ro-RO", audience: "customer", market: "RO" }]]),
      },
    )

    expect(locale).toEqual({
      requestedLocale: "ro-RO",
      sourceLocale: "en-GB",
      servedLocale: "ro-RO",
      matchKind: "fallback_chain",
    })
  })

  it("changes the namespaced ship fields in every referencing cruise document", () => {
    const references = ["cruise_a", "cruise_b", "cruise_c"]
    const source = {
      subject: { entityModule: "cruise-ships", entityId: "crsh_shared" },
      scope: { locale: "ro-RO", audience: "customer", market: "RO" } as const,
      values: new Map<string, unknown>([["name", "Source ship"]]),
    }
    const overlaid = {
      ...source,
      values: new Map<string, unknown>([["name", "Nava"]]),
    }

    const before = references.map((entityId) => ({
      entityId,
      fields: Object.fromEntries(projectEffectiveCruiseShipReference(source)),
    }))
    const after = references.map((entityId) => ({
      entityId,
      fields: Object.fromEntries(projectEffectiveCruiseShipReference(overlaid)),
    }))

    expect(after).toHaveLength(references.length)
    expect(after.every((document) => document.fields["ship.name"] === "Nava")).toBe(true)
    expect(
      after.every(
        (document, index) => document.fields["ship.name"] !== before[index]?.fields["ship.name"],
      ),
    ).toBe(true)
  })
})
