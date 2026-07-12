import { buildSourcedBookingRows } from "@voyant-travel/catalog-node/standard-node/booking-runtime"
import { describe, expect, it } from "vitest"

describe("buildSourcedBookingRows", () => {
  it("materializes a readable booking row for sourced catalog commits", () => {
    const rows = buildSourcedBookingRows({
      actorId: "user_1",
      request: {
        quoteId: "quote_1",
        party: {
          personId: "person_1",
          billing: {
            contact: {
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.com",
              phone: "+40 700 000 000",
            },
          },
        },
        parameters: {
          draft: {
            configure: {
              departureDate: "2026-08-15",
              pax: { adults: 2, children: 1 },
            },
          },
        },
      },
      result: {
        bookingId: "book_01sourced",
        orderRef: "upstream_order_1",
        status: "held",
        snapshotId: "snap_1",
        pricing: {
          base_amount: 10000,
          taxes: 1900,
          fees: 500,
          surcharges: 0,
          currency: "EUR",
        },
      },
      snapshot: {
        id: "snap_1",
        booking_id: "book_01sourced",
        entity_module: "products",
        entity_id: "demo_product_1",
        source_kind: "demo",
        source_provider: null,
        source_connection_id: null,
        source_ref: "demo_ref_1",
        frozen_payload: { content: { product: { name: "Lisbon package" } } },
        overlay_state_at_capture: null,
        pricing_base_amount: "10000",
        pricing_taxes: "1900",
        pricing_fees: "500",
        pricing_surcharges: "0",
        pricing_currency: "EUR",
        pricing_breakdown: null,
        pricing_applied_offers: null,
        idempotency_key: "idem_1",
        captured_at: new Date("2026-07-02T08:00:00Z"),
      },
    })

    expect(rows.booking).toMatchObject({
      id: "book_01sourced",
      status: "on_hold",
      personId: "person_1",
      sourceType: "api_partner",
      externalBookingRef: "upstream_order_1",
      contactFirstName: "Ada",
      contactLastName: "Lovelace",
      sellCurrency: "EUR",
      sellAmountCents: 12400,
      startDate: "2026-08-15",
      endDate: "2026-08-15",
      pax: 3,
    })
    expect(rows.item).toMatchObject({
      bookingId: "book_01sourced",
      title: "Lisbon package",
      status: "on_hold",
      sellCurrency: "EUR",
      totalSellAmountCents: 12400,
      productId: "demo_product_1",
      sourceSnapshotId: "snap_1",
      sourceOfferId: "demo_ref_1",
    })
    expect(rows.activity).toMatchObject({
      bookingId: "book_01sourced",
      actorId: "user_1",
      activityType: "booking_created",
    })
  })
})
