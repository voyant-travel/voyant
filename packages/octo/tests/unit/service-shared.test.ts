// agent-quality: file-size exception -- owner: octo; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { describe, expect, it } from "vitest"

import {
  buildProductContent,
  buildProjectedAvailability,
  deriveOctoAvailabilityStatus,
  formatLocalDateTime,
  inferOctoAvailabilityType,
  inferOctoUnitType,
  mapBookingArtifact,
  mapBookingStatus,
  mapUnit,
  pickBookingContact,
  pickOptionStartTimes,
  pickPayloadString,
  toIsoString,
} from "../../src/service-shared.js"

describe("toIsoString()", () => {
  it("returns ISO string for a Date", () => {
    expect(toIsoString(new Date("2026-04-25T10:00:00Z"))).toBe("2026-04-25T10:00:00.000Z")
  })

  it("returns null for null/undefined", () => {
    expect(toIsoString(null)).toBeNull()
    expect(toIsoString(undefined)).toBeNull()
  })
})

describe("formatLocalDateTime()", () => {
  it("formats a UTC instant to local wall-clock in the requested zone", () => {
    const utc = new Date("2026-07-01T10:00:00Z")
    expect(formatLocalDateTime(utc, "Europe/Bucharest")).toBe("2026-07-01T13:00:00")
    expect(formatLocalDateTime(utc, "America/New_York")).toBe("2026-07-01T06:00:00")
    expect(formatLocalDateTime(utc, "UTC")).toBe("2026-07-01T10:00:00")
  })

  it("zero-pads single-digit components", () => {
    const utc = new Date("2026-01-05T03:04:05Z")
    expect(formatLocalDateTime(utc, "UTC")).toBe("2026-01-05T03:04:05")
  })
})

describe("inferOctoAvailabilityType()", () => {
  it("maps `open` to OPENING_HOURS", () => {
    expect(inferOctoAvailabilityType("open")).toBe("OPENING_HOURS")
  })

  it("maps date / date_time / null to START_TIME", () => {
    expect(inferOctoAvailabilityType("date")).toBe("START_TIME")
    expect(inferOctoAvailabilityType("date_time")).toBe("START_TIME")
    expect(inferOctoAvailabilityType(null as never)).toBe("START_TIME")
  })
})

describe("inferOctoUnitType()", () => {
  const cases: Array<
    [{ name: string; code: string | null; unitType: "person" | "group" }, string]
  > = [
    [{ name: "Adult", code: "adult", unitType: "person" }, "ADULT"],
    [{ name: "Child", code: null, unitType: "person" }, "CHILD"],
    [{ name: "Youth ticket", code: null, unitType: "person" }, "YOUTH"],
    [{ name: "Teen rate", code: null, unitType: "person" }, "YOUTH"],
    [{ name: "Infant", code: null, unitType: "person" }, "INFANT"],
    [{ name: "Baby", code: null, unitType: "person" }, "INFANT"],
    [{ name: "Family pack", code: "fam", unitType: "group" }, "FAMILY"],
    [{ name: "Senior", code: null, unitType: "person" }, "SENIOR"],
    [{ name: "Student", code: null, unitType: "person" }, "STUDENT"],
    [{ name: "Military discount", code: null, unitType: "person" }, "MILITARY"],
    [{ name: "Generic person", code: null, unitType: "person" }, "ADULT"],
    [{ name: "Mystery group", code: null, unitType: "group" }, "OTHER"],
  ]

  for (const [unit, expected] of cases) {
    it(`${unit.name} → ${expected}`, () => {
      expect(inferOctoUnitType(unit)).toBe(expected)
    })
  }

  it("matches against code as well as name", () => {
    expect(inferOctoUnitType({ name: "Generic", code: "child-rate", unitType: "person" })).toBe(
      "CHILD",
    )
  })
})

describe("deriveOctoAvailabilityStatus()", () => {
  it("returns SOLD_OUT when slot status is sold_out", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "sold_out", unlimited: false, initialPax: 10, remainingPax: 0 },
        "limited",
      ),
    ).toBe("SOLD_OUT")
  })

  it("returns CLOSED when slot status is closed or cancelled", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "closed", unlimited: false, initialPax: 10, remainingPax: 5 },
        "limited",
      ),
    ).toBe("CLOSED")
    expect(
      deriveOctoAvailabilityStatus(
        { status: "cancelled", unlimited: false, initialPax: 10, remainingPax: 5 },
        "limited",
      ),
    ).toBe("CLOSED")
  })

  it("returns FREESALE when capacityMode is free_sale, regardless of pax counts", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "open", unlimited: false, initialPax: 10, remainingPax: 1 },
        "free_sale",
      ),
    ).toBe("FREESALE")
  })

  it("returns FREESALE when slot.unlimited is true", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "open", unlimited: true, initialPax: null, remainingPax: null },
        "limited",
      ),
    ).toBe("FREESALE")
  })

  it("returns SOLD_OUT when remainingPax is 0", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "open", unlimited: false, initialPax: 10, remainingPax: 0 },
        "limited",
      ),
    ).toBe("SOLD_OUT")
  })

  it("returns LIMITED when fewer than 50% of initialPax remain", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "open", unlimited: false, initialPax: 10, remainingPax: 4 },
        "limited",
      ),
    ).toBe("LIMITED")
  })

  it("returns AVAILABLE when ≥50% remain", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "open", unlimited: false, initialPax: 10, remainingPax: 5 },
        "limited",
      ),
    ).toBe("AVAILABLE")
  })

  it("returns AVAILABLE when initialPax/remainingPax are null and not unlimited", () => {
    expect(
      deriveOctoAvailabilityStatus(
        { status: "open", unlimited: false, initialPax: null, remainingPax: null },
        "limited",
      ),
    ).toBe("AVAILABLE")
  })
})

describe("mapBookingStatus()", () => {
  it("maps every booking status into the OCTO reservation set", () => {
    expect(mapBookingStatus("on_hold")).toBe("ON_HOLD")
    expect(mapBookingStatus("expired")).toBe("EXPIRED")
    expect(mapBookingStatus("cancelled")).toBe("CANCELLED")
    expect(mapBookingStatus("confirmed")).toBe("CONFIRMED")
    expect(mapBookingStatus("completed")).toBe("CONFIRMED")
    expect(mapBookingStatus("draft" as never)).toBe("CONFIRMED")
    expect(mapBookingStatus("in_progress" as never)).toBe("CONFIRMED")
  })
})

describe("mapUnit()", () => {
  it("maps a unit row into an OCTO projected unit with restrictions", () => {
    const unit = {
      id: "pdse_1",
      optionId: "popt_1",
      name: "Adult ticket",
      code: "adult",
      description: null,
      unitType: "person",
      isRequired: false,
      isSelectableInQuote: true,
      sortOrder: 0,
      minQuantity: 1,
      maxQuantity: 10,
      minAge: 18,
      maxAge: 99,
      occupancyMin: null,
      occupancyMax: null,
      paxMultiplier: 1,
      capacityCount: 1,
      isPaxBearing: true,
      includedAdjustments: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      // biome-ignore lint/suspicious/noExplicitAny: relax type for synthetic test row -- owner: octo; existing suppression is intentional pending typed cleanup.
    } as any

    const projected = mapUnit(unit)
    expect(projected.id).toBe("pdse_1")
    expect(projected.name).toBe("Adult ticket")
    expect(projected.code).toBe("adult")
    expect(projected.type).toBe("ADULT")
    expect(projected.restrictions).toEqual({
      minAge: 18,
      maxAge: 99,
      minQuantity: 1,
      maxQuantity: 10,
      occupancyMin: undefined,
      occupancyMax: undefined,
    })
  })
})

describe("buildProductContent()", () => {
  it("partitions features by featureType into OCTO content sections", () => {
    const features = [
      {
        id: "f1",
        productId: "p1",
        featureType: "highlight",
        title: "Sunset views",
        description: "Best at dusk",
        sortOrder: 0,
      },
      {
        id: "f2",
        productId: "p1",
        featureType: "inclusion",
        title: "Lunch",
        description: null,
        sortOrder: 1,
      },
      {
        id: "f3",
        productId: "p1",
        featureType: "exclusion",
        title: "Tips",
        description: "Optional",
        sortOrder: 2,
      },
      {
        id: "f4",
        productId: "p1",
        featureType: "important_information",
        title: "Bring ID",
        description: null,
        sortOrder: 3,
      },
      {
        id: "f5",
        productId: "p1",
        featureType: "other",
        title: "Photo points",
        description: null,
        sortOrder: 4,
      },
      // biome-ignore lint/suspicious/noExplicitAny: relax for synthetic rows -- owner: octo; existing suppression is intentional pending typed cleanup.
    ] as any

    const faqs = [
      { id: "fq1", productId: "p1", question: "Is it kid-friendly?", answer: "Yes" },
      // biome-ignore lint/suspicious/noExplicitAny: relax for synthetic rows -- owner: octo; existing suppression is intentional pending typed cleanup.
    ] as any

    const locations = [
      {
        id: "ploc1",
        productId: "p1",
        locationType: "meeting_point",
        title: "Old Town",
        address: "Str. Lipscani 1",
        city: "Bucharest",
        countryCode: "RO",
        latitude: 44.4,
        longitude: 26.1,
        googlePlaceId: null,
        applePlaceId: null,
        tripadvisorLocationId: null,
      },
      // biome-ignore lint/suspicious/noExplicitAny: relax for synthetic rows -- owner: octo; existing suppression is intentional pending typed cleanup.
    ] as any

    const content = buildProductContent({ features, faqs, locations })

    expect(content.highlights.map((h) => h.title)).toEqual(["Sunset views", "Photo points"])
    expect(content.inclusions.map((i) => i.title)).toEqual(["Lunch"])
    expect(content.exclusions.map((e) => e.title)).toEqual(["Tips"])
    expect(content.importantInformation.map((i) => i.title)).toEqual(["Bring ID"])
    expect(content.faqs).toHaveLength(1)
    expect(content.locations[0]?.type).toBe("meeting_point")
  })
})

describe("pickOptionStartTimes()", () => {
  it("prefers option-specific start times when present", () => {
    const startTimes = [
      { id: "s1", optionId: "popt_1", startTimeLocal: "09:00" },
      { id: "s2", optionId: "popt_1", startTimeLocal: "13:00" },
      { id: "s3", optionId: null, startTimeLocal: "10:00" },
      // biome-ignore lint/suspicious/noExplicitAny: relax for synthetic rows -- owner: octo; existing suppression is intentional pending typed cleanup.
    ] as any

    const option = { id: "popt_1" } as Parameters<typeof pickOptionStartTimes>[0]
    expect(pickOptionStartTimes(option, startTimes)).toEqual(["09:00", "13:00"])
  })

  it("falls back to product-wide (option-null) start times when the option has none", () => {
    const startTimes = [
      { id: "s1", optionId: "popt_other", startTimeLocal: "09:00" },
      { id: "s2", optionId: null, startTimeLocal: "10:00" },
      // biome-ignore lint/suspicious/noExplicitAny: relax for synthetic rows -- owner: octo; existing suppression is intentional pending typed cleanup.
    ] as any

    const option = { id: "popt_1" } as Parameters<typeof pickOptionStartTimes>[0]
    expect(pickOptionStartTimes(option, startTimes)).toEqual(["10:00"])
  })

  it("returns empty when no option-specific or product-wide times exist", () => {
    const option = { id: "popt_1" } as Parameters<typeof pickOptionStartTimes>[0]
    expect(pickOptionStartTimes(option, [])).toEqual([])
  })
})

describe("pickPayloadString()", () => {
  it("returns the first non-empty string match in key order", () => {
    expect(pickPayloadString({ b: "second", a: "first" }, ["a", "b"])).toBe("first")
  })

  it("skips empty strings and non-string values", () => {
    expect(pickPayloadString({ a: "", b: 42, c: "found" }, ["a", "b", "c"])).toBe("found")
  })

  it("returns null when no key matches", () => {
    expect(pickPayloadString({ x: "1" }, ["a", "b"])).toBeNull()
  })

  it("returns null for null/undefined payload", () => {
    expect(pickPayloadString(null, ["a"])).toBeNull()
    expect(pickPayloadString(undefined, ["a"])).toBeNull()
  })
})

describe("mapBookingArtifact()", () => {
  function row(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "bkfl_1",
      bookingId: "book_1",
      bookingItemId: "bkit_1",
      travelerId: "bpar_1",
      fulfillmentType: "qr_code",
      deliveryChannel: "email",
      status: "issued",
      artifactUrl: "https://cdn.example.com/voucher.pdf",
      payload: null,
      issuedAt: new Date("2026-04-07T10:00:00Z"),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
      // biome-ignore lint/suspicious/noExplicitAny: synthetic test row -- owner: octo; existing suppression is intentional pending typed cleanup.
    } as any
  }

  it("falls back to artifactUrl as downloadUrl when payload is empty", () => {
    const artifact = mapBookingArtifact(row())
    expect(artifact.downloadUrl).toBe("https://cdn.example.com/voucher.pdf")
    expect(artifact.qrCode).toBeNull()
  })

  it("prefers payload.qrCode over artifactUrl for qr_code fulfillments", () => {
    const artifact = mapBookingArtifact(row({ payload: { qrCode: "qr-data" } }))
    expect(artifact.qrCode).toBe("qr-data")
  })

  it("derives qrCode from payload.code/voucherCode when fulfillmentType is qr_code", () => {
    const artifact = mapBookingArtifact(
      row({ fulfillmentType: "qr_code", payload: { voucherCode: "VCH-1" } }),
    )
    expect(artifact.qrCode).toBe("VCH-1")
  })

  it("populates pdfUrl from artifactUrl when fulfillmentType is pdf", () => {
    const artifact = mapBookingArtifact(
      row({ fulfillmentType: "pdf", artifactUrl: "https://cdn.example.com/x.pdf" }),
    )
    expect(artifact.pdfUrl).toBe("https://cdn.example.com/x.pdf")
  })

  it("does not derive a qrCode for non-qr fulfillments without an explicit payload key", () => {
    const artifact = mapBookingArtifact(
      row({ fulfillmentType: "pdf", payload: { voucherCode: "VCH-1" } }),
    )
    expect(artifact.qrCode).toBeNull()
    expect(artifact.voucherCode).toBe("VCH-1")
  })

  it("ISO-formats issuedAt and revokedAt", () => {
    const artifact = mapBookingArtifact(
      row({
        issuedAt: new Date("2026-04-07T10:00:00Z"),
        revokedAt: new Date("2026-04-08T11:00:00Z"),
      }),
    )
    expect(artifact.issuedAt).toBe("2026-04-07T10:00:00.000Z")
    expect(artifact.revokedAt).toBe("2026-04-08T11:00:00.000Z")
  })
})

describe("buildProjectedAvailability()", () => {
  function slot(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "asl_1",
      productId: "prod_1",
      optionId: "popt_1",
      dateLocal: "2026-07-01",
      startsAt: new Date("2026-07-01T10:00:00Z"),
      endsAt: new Date("2026-07-01T12:00:00Z"),
      timezone: "Europe/Bucharest",
      status: "open",
      unlimited: false,
      initialPax: 10,
      remainingPax: 4,
      capacityWaterline: null,
      capacityWaterlineStrategy: null,
      ...overrides,
      // biome-ignore lint/suspicious/noExplicitAny: synthetic test row -- owner: octo; existing suppression is intentional pending typed cleanup.
    } as any
  }

  it("formats local date-time using the slot's timezone", () => {
    const projected = buildProjectedAvailability(slot(), {
      capacityMode: "limited",
      timezone: "UTC",
    })
    expect(projected.localDateTimeStart).toBe("2026-07-01T13:00:00")
    expect(projected.localDateTimeEnd).toBe("2026-07-01T15:00:00")
    expect(projected.timeZone).toBe("Europe/Bucharest")
    expect(projected.status).toBe("LIMITED")
  })

  it("falls back to product timezone when slot.timezone is empty, then UTC", () => {
    const noSlotTz = buildProjectedAvailability(slot({ timezone: "" }), {
      capacityMode: "limited",
      timezone: "America/New_York",
    })
    expect(noSlotTz.timeZone).toBe("America/New_York")

    const noProductTz = buildProjectedAvailability(slot({ timezone: "" }), null)
    expect(noProductTz.timeZone).toBe("UTC")
  })

  it("emits null capacity / vacancies when slot.unlimited is true", () => {
    const projected = buildProjectedAvailability(
      slot({ unlimited: true, initialPax: null, remainingPax: null }),
      { capacityMode: "limited", timezone: "UTC" },
    )
    expect(projected.capacity).toBeNull()
    expect(projected.vacancies).toBeNull()
    expect(projected.status).toBe("FREESALE")
  })

  it("preserves localDateTimeEnd as null when the slot has no end", () => {
    const projected = buildProjectedAvailability(slot({ endsAt: null }), {
      capacityMode: "limited",
      timezone: "UTC",
    })
    expect(projected.localDateTimeEnd).toBeNull()
  })
})

describe("pickBookingContact() — additional cases", () => {
  it("returns null when there are no participants and no contact snapshot", () => {
    const contact = pickBookingContact({
      booking: {
        contactFirstName: null,
        contactLastName: null,
        contactEmail: null,
        contactPhone: null,
        contactPreferredLanguage: null,
      },
      participants: [],
    })
    expect(contact).toBeNull()
  })

  it("falls back to a non-primary traveler when no primary exists", () => {
    const contact = pickBookingContact({
      booking: {
        contactFirstName: null,
        contactLastName: null,
        contactEmail: null,
        contactPhone: null,
        contactPreferredLanguage: null,
      },
      participants: [
        {
          id: "bp_1",
          participantType: "traveler",
          isPrimary: false,
          firstName: "First",
          lastName: "One",
          email: null,
          phone: null,
          preferredLanguage: null,
        },
      ],
    })
    expect(contact?.travelerId).toBe("bp_1")
  })

  it("ignores staff participants entirely", () => {
    const contact = pickBookingContact({
      booking: {
        contactFirstName: null,
        contactLastName: null,
        contactEmail: null,
        contactPhone: null,
        contactPreferredLanguage: null,
      },
      participants: [
        {
          id: "bp_staff",
          participantType: "staff",
          isPrimary: true,
          firstName: "Guide",
          lastName: "X",
          email: null,
          phone: null,
          preferredLanguage: null,
        },
        {
          id: "bp_t",
          participantType: "occupant",
          isPrimary: false,
          firstName: "Real",
          lastName: "Person",
          email: null,
          phone: null,
          preferredLanguage: null,
        },
      ],
    })
    expect(contact?.travelerId).toBe("bp_t")
  })
})
