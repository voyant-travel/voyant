import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  calendarEnvelopeSchema,
  listEnvelopeSchema,
  octoAvailabilityCalendarDaySchema,
  octoAvailabilitySchema,
  octoBookingSchema,
  octoProductSchema,
  octoRedemptionEventSchema,
} from "../../src/routes/openapi-schemas.js"
import type {
  OctoProjectedAvailability,
  OctoProjectedBookingRedemptionEvent,
  OctoProjectedProduct,
} from "../../src/types.js"

/**
 * Response contract tests (voyant#2114 — octo sub-batch) for the OCTo
 * connectivity routes. The octo surface serves OCTo-shaped PROJECTIONS, not
 * Drizzle rows, so the fixtures are typed against the projected `types.ts`
 * shapes (a field rename/retype there breaks compilation) and round-tripped
 * through JSON to mirror `c.json`. The schemas mirror the response shapes
 * declared in `routes.ts`: single `{ data }` envelopes for the detail routes,
 * the shared `{ data, total, limit, offset }` list envelope for the list
 * routes, and the `{ data, total }` calendar envelope.
 *
 * The booking projection's `extensions` bag carries three origin-tracking
 * columns (`originSource` / `providerSourceRef` / `providerOrderRef`) the
 * service hydrates on top of the documented `types.ts` `OctoProjectedBooking`
 * shape, so the booking fixture is an explicit wire literal (not typed against
 * the stale interface) covering every documented field.
 */

const productRow: OctoProjectedProduct = {
  id: "prod_00000000000000000000000000",
  name: "Bucharest Food Tour",
  description: "Tasting walk",
  timeZone: "Europe/Bucharest",
  availabilityType: "START_TIME",
  allowFreesale: false,
  instantConfirmation: true,
  options: [
    {
      id: "opt_00000000000000000000000000",
      name: "Morning departure",
      code: "AM",
      default: true,
      availabilityLocalStartTimes: ["09:00"],
      units: [
        {
          id: "unit_0000000000000000000000000",
          name: "Adult ticket",
          code: "adult",
          type: "ADULT",
          restrictions: { minAge: 18 },
        },
      ],
    },
  ],
  content: {
    highlights: [],
    inclusions: [{ id: "feat_1", title: "Local tastings", description: null }],
    exclusions: [],
    importantInformation: [],
    faqs: [],
    locations: [],
  },
  extensions: {
    status: "active",
    visibility: "public",
    activated: true,
    facilityId: null,
    bookingMode: "date_time",
    capabilityCodes: ["instant_confirmation"],
    deliveryFormats: [],
  },
}

const availabilityRow: OctoProjectedAvailability = {
  id: "aslot_0000000000000000000000000",
  productId: productRow.id,
  optionId: "opt_00000000000000000000000000",
  localDateTimeStart: "2026-08-01T09:00:00+03:00",
  localDateTimeEnd: null,
  timeZone: "Europe/Bucharest",
  status: "AVAILABLE",
  vacancies: 8,
  capacity: 10,
}

const calendarDay = {
  localDate: "2026-08-01",
  status: "AVAILABLE" as const,
  vacancies: 8,
  capacity: 10,
  availabilityIds: [availabilityRow.id],
}

const redemptionRow: OctoProjectedBookingRedemptionEvent = {
  id: "bred_0000000000000000000000000",
  bookingItemId: "bki_00000000000000000000000000",
  travelerId: null,
  redeemedAt: "2026-08-01T09:05:00.000Z",
  redeemedBy: "gate-agent",
  location: "Main gate",
  method: "scan",
  metadata: null,
}

// Explicit wire literal — the service hydrates `extensions` with the three
// origin-tracking fields beyond the documented `OctoProjectedBooking` interface.
const bookingRow = {
  id: "bkg_00000000000000000000000000",
  bookingNumber: "BK-0001",
  status: "ON_HOLD" as const,
  availabilityId: availabilityRow.id,
  contact: {
    travelerId: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: null,
    language: "en",
  },
  unitItems: [
    {
      bookingItemId: "bki_00000000000000000000000000",
      title: "Tour admission",
      itemType: "product",
      status: "held",
      quantity: 2,
      productId: productRow.id,
      optionId: "opt_00000000000000000000000000",
      unitId: null,
      pricingCategoryId: null,
      availabilityId: availabilityRow.id,
      travelerIds: [],
    },
  ],
  fulfillments: [
    {
      id: "bful_0000000000000000000000000",
      bookingItemId: "bki_00000000000000000000000000",
      travelerId: null,
      type: "qr_code",
      deliveryChannel: "download",
      status: "issued",
      artifactUrl: "https://example.com/ticket.pdf",
      payload: { qrCode: "qr-value", voucherCode: "VOUCH-99" },
      issuedAt: "2026-04-07T10:00:00.000Z",
      revokedAt: null,
    },
  ],
  artifacts: [
    {
      fulfillmentId: "bful_0000000000000000000000000",
      bookingItemId: "bki_00000000000000000000000000",
      travelerId: null,
      type: "qr_code",
      deliveryChannel: "download",
      status: "issued",
      artifactUrl: "https://example.com/ticket.pdf",
      downloadUrl: "https://example.com/ticket.pdf",
      pdfUrl: null,
      qrCode: "qr-value",
      barcode: null,
      voucherCode: "VOUCH-99",
      issuedAt: "2026-04-07T10:00:00.000Z",
      revokedAt: null,
    },
  ],
  redemptions: [redemptionRow],
  references: {
    resellerReference: "OTA-REF-42",
    offerId: null,
    offerNumber: null,
    orderId: "SRC-ORD-42",
    orderNumber: null,
    supplierReferences: [
      {
        id: "bss_00000000000000000000000000",
        supplierServiceId: null,
        serviceName: "Walking tour supplier",
        status: "confirmed",
        supplierReference: "SUP-77",
        confirmedAt: "2026-04-07T10:00:00.000Z",
      },
    ],
  },
  holdExpiresAt: "2026-08-01T08:30:00.000Z",
  confirmedAt: null,
  cancelledAt: null,
  expiredAt: null,
  utcRedeemedAt: null,
  extensions: {
    sourceType: "reseller",
    externalBookingRef: "OTA-REF-42",
    communicationLanguage: "en",
    personId: null,
    organizationId: null,
    sellCurrency: "EUR",
    baseCurrency: null,
    originSource: "provider_source_order",
    providerSourceRef: "SRC-BOOK-42",
    providerOrderRef: "SRC-ORD-42",
  },
}

const pagination = { total: 1, limit: 50, offset: 0 } as const

const dataCases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "product", row: productRow, schema: octoProductSchema },
  { name: "availability", row: availabilityRow, schema: octoAvailabilitySchema },
  { name: "booking", row: bookingRow, schema: octoBookingSchema },
]

const listCases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "product", row: productRow, schema: octoProductSchema },
  { name: "availability", row: availabilityRow, schema: octoAvailabilitySchema },
  { name: "booking", row: bookingRow, schema: octoBookingSchema },
]

describe("octo projection response contracts", () => {
  for (const { name, row, schema } of dataCases) {
    it(`the ${name} { data } envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  for (const { name, row, schema } of listCases) {
    it(`the ${name} list envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row], ...pagination }))
      const parsed = listEnvelopeSchema(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the calendar envelope satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [calendarDay], total: 1 }))
    const parsed = calendarEnvelopeSchema(octoAvailabilityCalendarDaySchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the redemptions { data } envelope satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [redemptionRow] }))
    const parsed = z.object({ data: z.array(octoRedemptionEventSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
