import { OVERLAY_DEFAULT_SCOPE } from "@voyant-travel/catalog"
import { catalogSourcedEntriesTable } from "@voyant-travel/catalog/schema-sourced-entries"
import { describe, expect, it } from "vitest"

import {
  accommodationPropertyOverlayInvalidationScope,
  accommodationPropertyProjectionFromContent,
  assertAccommodationPropertyOverlayScope,
  effectiveAccommodationPropertyLocale,
  parseAccommodationPropertyOverlayValue,
  publicAccommodationPropertyProjectionSchema,
  readAccommodationPropertyOverlayState,
  validateEffectiveAccommodationPropertyProjection,
} from "../../src/service-presentation-subjects.js"

describe("accommodation property overlay contracts", () => {
  it("derives one provider property projection during content refresh", () => {
    const projection = accommodationPropertyProjectionFromContent(
      {
        hotel: { id: "hotel_17", name: "Provider Hotel", hero_image_url: null },
        room_types: [
          { id: "room_1", name: "Room", beds: [], amenities: [], images: ["a.jpg", "a.jpg"] },
          { id: "room_2", name: "Suite", beds: [], amenities: [], images: ["b.jpg"] },
        ],
        rate_plans: [],
        meal_plans: [],
        amenities: [
          { id: "wifi", name: "Wi-Fi" },
          { id: "wifi-2", name: "Wi-Fi" },
        ],
        policies: [],
      },
      "ro-RO",
    )

    expect(projection).toMatchObject({
      id: "hotel_17",
      name: "Provider Hotel",
      locale: "ro-RO",
      gallery: ["a.jpg", "b.jpg"],
      amenities: ["Wi-Fi"],
    })
  })

  it("keeps the durable local identity authoritative over provider projection keys", async () => {
    const db = presentationDb(
      new Map<unknown, unknown[]>([
        [
          catalogSourcedEntriesTable,
          [
            {
              entity_module: "accommodation-properties",
              entity_id: "properties_01local",
              source_kind: "bedbank:demo",
              source_provider: "Demo Bedbank",
              source_connection_id: "conn_demo",
              source_ref: "hotel_17",
              status: "active",
              projection: {
                id: "provider-controlled-id",
                "source.kind": "provider-controlled-kind",
                "source.ref": "provider-controlled-ref",
                name: "Provider Hotel",
                locale: "en-GB",
              },
            },
          ],
        ],
      ]),
    )

    const state = await readAccommodationPropertyOverlayState(db, "properties_01local", {
      locale: "en-GB",
      audience: "staff",
      market: "default",
    })

    expect(state?.source).toMatchObject({
      id: "properties_01local",
      "source.kind": "bedbank:demo",
      "source.ref": "hotel_17",
    })
    expect(state?.effective).toMatchObject({
      id: "properties_01local",
      "source.kind": "bedbank:demo",
      "source.ref": "hotel_17",
    })
  })

  it("validates every overlay value against its field contract", () => {
    expect(parseAccommodationPropertyOverlayValue("name", "Hotelul")).toBe("Hotelul")
    expect(parseAccommodationPropertyOverlayValue("amenities", ["Pool", "Wi-Fi"])).toEqual([
      "Pool",
      "Wi-Fi",
    ])
    expect(() => parseAccommodationPropertyOverlayValue("name", { html: "Hotel" })).toThrow()
    expect(() => parseAccommodationPropertyOverlayValue("highlights", "Pool")).toThrow()
    expect(() => parseAccommodationPropertyOverlayValue("hero_image_url", "javascript:x")).toThrow()
  })

  it("rejects an invalid merged effective property before persistence", () => {
    expect(() =>
      validateEffectiveAccommodationPropertyProjection(
        new Map<string, unknown>([
          ["id", "prop_1"],
          ["source.kind", "provider"],
          ["name", "Source hotel"],
          ["star_rating", "five"],
        ]),
        [],
        {
          field_path: "name",
          scope: { locale: "ro-RO", audience: "customer", market: "default" },
          value: "Hotelul",
          origin: { kind: "admin-ui", user_id: "usr_editor" },
        },
      ),
    ).toThrow()
  })

  it("requires real locales for localized fields and default for non-localized fields", () => {
    expect(() => assertAccommodationPropertyOverlayScope(true, "ro-RO")).not.toThrow()
    expect(() => assertAccommodationPropertyOverlayScope(true, OVERLAY_DEFAULT_SCOPE)).toThrow(
      /real locale/i,
    )
    expect(() =>
      assertAccommodationPropertyOverlayScope(false, OVERLAY_DEFAULT_SCOPE),
    ).not.toThrow()
    expect(() => assertAccommodationPropertyOverlayScope(false, "ro-RO")).toThrow(/locale=default/i)
  })

  it("uses entry-wide wildcard invalidation for non-localized property media", () => {
    const scope = { locale: "default", audience: "customer" as const, market: "RO" }
    expect(accommodationPropertyOverlayInvalidationScope("hero_image_url", scope)).toEqual({
      locale: "default",
      audience: "default",
      market: "default",
    })
    expect(
      accommodationPropertyOverlayInvalidationScope("name", {
        locale: "ro-RO",
        audience: "partner",
        market: "RO",
      }),
    ).toEqual({ locale: "ro-RO", audience: "partner", market: "RO" })
  })

  it("reports overlay-only locales", () => {
    const source = new Map<string, unknown>([["id", "prop_1"]])
    const effective = {
      values: new Map<string, unknown>([
        ["id", "prop_1"],
        ["description", "Descriere"],
      ]),
      hidden: new Set<string>(),
      provenance: new Map<string, { locale: string; audience: "customer"; market: string } | null>([
        ["id", null],
        ["description", { locale: "ro-RO", audience: "customer" as const, market: "default" }],
      ]),
    }

    expect(
      effectiveAccommodationPropertyLocale("ro-RO", "en-GB", source, effective as never),
    ).toEqual({
      requestedLocale: "ro-RO",
      sourceLocale: "en-GB",
      servedLocale: "ro-RO",
      matchKind: "overlay-only",
    })
  })

  it("marks requested-locale overlays that replace fallback source as mixed", () => {
    const source = new Map<string, unknown>([
      ["id", "prop_1"],
      ["name", "Source hotel"],
    ])
    const effective = {
      values: new Map<string, unknown>([
        ["id", "prop_1"],
        ["name", "Hotelul"],
      ]),
      hidden: new Set<string>(),
      provenance: new Map<string, { locale: string; audience: "customer"; market: string } | null>([
        ["id", null],
        ["name", { locale: "ro-RO", audience: "customer" as const, market: "default" }],
      ]),
    }

    expect(
      effectiveAccommodationPropertyLocale("ro-RO", "en-GB", source, effective as never),
    ).toEqual({
      requestedLocale: "ro-RO",
      sourceLocale: "en-GB",
      servedLocale: "ro-RO",
      matchKind: "mixed",
    })
  })

  it("does not treat default-locale media overlays as localized content", () => {
    const source = new Map<string, unknown>([["id", "prop_1"]])
    const effective = {
      values: new Map<string, unknown>([
        ["id", "prop_1"],
        ["gallery", ["https://cdn.example/property.jpg"]],
      ]),
      hidden: new Set<string>(),
      provenance: new Map<string, { locale: string; audience: "customer"; market: string } | null>([
        ["id", null],
        ["gallery", { locale: "default", audience: "customer", market: "default" }],
      ]),
    }

    expect(
      effectiveAccommodationPropertyLocale("ro-RO", "en-GB", source, effective as never),
    ).toEqual({
      requestedLocale: "ro-RO",
      sourceLocale: "en-GB",
      servedLocale: "en-GB",
      matchKind: "mixed",
    })
  })

  it("rejects staff-only provenance fields in a public projection", () => {
    expect(() =>
      publicAccommodationPropertyProjectionSchema.parse({
        id: "prop_1",
        name: "Hotelul",
        "source.ref": "provider-secret",
      }),
    ).toThrow()
  })
})

function presentationDb(rowsByTable: Map<unknown, unknown[]>) {
  return {
    select() {
      return {
        from(table: unknown) {
          const rows = rowsByTable.get(table) ?? []
          return {
            where() {
              const query = Promise.resolve(rows) as Promise<unknown[]> & {
                limit: (count: number) => Promise<unknown[]>
              }
              query.limit = async (count: number) => rows.slice(0, count)
              return query
            },
          }
        },
      }
    },
  } as never
}
