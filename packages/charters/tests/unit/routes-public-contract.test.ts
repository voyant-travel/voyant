/**
 * OpenAPI contract tests for the public charter routes (voyant#2191).
 *
 * Asserts the documented response schemas actually match the runtime payloads
 * for the clean local-only shapes — the voyages list (route 3) and the composed
 * quotes (routes 5/6) — so the spec can't drift from the wire. External-dispatch
 * behaviour is covered in `routes-shape.test.ts`; here we focus on the shapes
 * the spec models honestly.
 */

import { mountTestApp } from "@voyant-travel/voyant-test-utils/http"
import { afterEach, describe, expect, it } from "vitest"

import type { ExternalCharterSuite, ExternalCharterVoyage } from "../../src/adapters/index.js"
import { MockCharterAdapter } from "../../src/adapters/mock.js"
import { clearCharterAdapters, registerCharterAdapter } from "../../src/adapters/registry.js"
import {
  chartersPublicRoutes,
  perSuiteQuoteResponseSchema,
  voyageDetailResponseSchema,
  voyageItemSchema,
  wholeYachtQuoteResponseSchema,
} from "../../src/routes-public.js"
import { composePerSuiteQuote, composeWholeYachtQuote } from "../../src/service-pricing.js"

afterEach(() => clearCharterAdapters())

const seedVoyage: ExternalCharterVoyage = {
  sourceRef: { externalId: "ext-voy-1" },
  productRef: { externalId: "ext-prod-1" },
  yachtRef: { externalId: "ext-yacht-1" },
  voyageCode: "MED-2026-04",
  departureDate: "2026-04-12",
  returnDate: "2026-04-19",
  nights: 7,
  bookingModes: ["per_suite", "whole_yacht"],
  wholeYachtPricesByCurrency: { USD: "5000000.00" },
  apaPercentOverride: "30.00",
}
const seedSuite: ExternalCharterSuite = {
  sourceRef: { externalId: "ext-suite-1" },
  voyageRef: seedVoyage.sourceRef,
  suiteCode: "OS-1",
  suiteName: "Owners Suite",
  pricesByCurrency: { USD: "150000.00" },
  portFeesByCurrency: { USD: "1000.00" },
  availability: "available",
  maxGuests: 4,
}

function seedAdapter() {
  const adapter = new MockCharterAdapter({ name: "voyant-connect" })
  adapter.addProduct(
    {
      sourceRef: { externalId: "ext-prod-1" },
      name: "Mediterranean Spring",
      slug: "med-spring",
      lineName: "Acme",
      defaultBookingModes: ["per_suite", "whole_yacht"],
      defaultApaPercent: "27.50",
      status: "live",
    },
    [seedVoyage],
  )
  adapter.setVoyageSuites(seedVoyage.sourceRef, [seedSuite])
  adapter.setVoyageSchedule(seedVoyage.sourceRef, [])
  registerCharterAdapter(adapter)
  return adapter
}

describe("public routes — pure-schema parity", () => {
  it("a composed per-suite quote satisfies perSuiteQuoteResponseSchema", () => {
    const quote = composePerSuiteQuote({
      voyageId: "chrv_abc",
      suite: {
        id: "chst_def",
        suiteName: "Owners Suite",
        pricesByCurrency: { USD: "150000.00" },
        portFeesByCurrency: { USD: "1000.00" },
      },
      currency: "USD",
    })
    const parsed = perSuiteQuoteResponseSchema.safeParse({ data: quote })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.data.total).toBe("151000.00")
  })

  it("a composed whole-yacht quote satisfies wholeYachtQuoteResponseSchema", () => {
    const quote = composeWholeYachtQuote({
      voyage: {
        id: "chrv_abc",
        wholeYachtPricesByCurrency: { USD: "5000000.00" },
        apaPercentOverride: "30.00",
      },
      productDefaultApaPercent: null,
      currency: "USD",
    })
    const parsed = wholeYachtQuoteResponseSchema.safeParse({ data: quote })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.data.apaAmount).toBe("1500000.00")
    expect(parsed.data?.data.total).toBe("6500000.00")
  })
})

describe("public routes — wire parity for documented external shapes", () => {
  it("POST /voyages/<external>/quote/per-suite matches perSuiteQuoteResponseSchema", async () => {
    seedAdapter()
    const app = mountTestApp(chartersPublicRoutes, { db: undefined })
    const res = await app.request("/voyages/voyant-connect:ext-voy-1/quote/per-suite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suiteId: "ext-suite-1", currency: "USD" }),
    })
    expect(res.status).toBe(200)
    const parsed = perSuiteQuoteResponseSchema.safeParse(await res.json())
    expect(parsed.success).toBe(true)
    expect(parsed.data?.data.total).toBe("151000.00")
  })

  it("POST /voyages/<external>/quote/whole-yacht matches wholeYachtQuoteResponseSchema", async () => {
    seedAdapter()
    const app = mountTestApp(chartersPublicRoutes, { db: undefined })
    const res = await app.request("/voyages/voyant-connect:ext-voy-1/quote/whole-yacht", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: "USD" }),
    })
    expect(res.status).toBe(200)
    const parsed = wholeYachtQuoteResponseSchema.safeParse(await res.json())
    expect(parsed.success).toBe(true)
    expect(parsed.data?.data.total).toBe("6500000.00")
  })

  it("GET /voyages/<external> satisfies the external branch of voyageDetailResponseSchema", async () => {
    seedAdapter()
    const app = mountTestApp(chartersPublicRoutes, { db: undefined })
    const res = await app.request("/voyages/voyant-connect:ext-voy-1")
    expect(res.status).toBe(200)
    const parsed = voyageDetailResponseSchema.safeParse(await res.json())
    expect(parsed.success).toBe(true)
  })
})

describe("public routes — voyageItemSchema models the voyages-list row", () => {
  // The list/local-detail rows serialize raw `charter_voyages` rows. Drizzle
  // returns `date` columns as strings and `timestamp` columns as `Date`s that
  // JSON-encode to ISO strings; assert the schema accepts a representative wire
  // row so the spec (route 3 = listResponseSchema(voyageItemSchema)) can't drift.
  it("accepts a representative serialized voyage row", () => {
    const wireRow = {
      id: "chrv_abc",
      productId: "chrt_abc",
      yachtId: "chry_abc",
      voyageCode: "MED-2026-04",
      name: null,
      embarkPortFacilityId: null,
      embarkPortName: "Nice",
      disembarkPortFacilityId: null,
      disembarkPortName: "Athens",
      departureDate: "2026-04-12",
      returnDate: "2026-04-19",
      nights: 7,
      bookingModes: ["per_suite", "whole_yacht"],
      appointmentOnly: false,
      wholeYachtPricesByCurrency: { USD: "5000000.00" },
      apaPercentOverride: "30.00",
      mybaTemplateIdOverride: null,
      charterAreaOverride: null,
      salesStatus: "open",
      availabilityNote: null,
      externalRefs: {},
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect(voyageItemSchema.safeParse(wireRow).success).toBe(true)
  })
})
