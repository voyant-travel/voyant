import { describe, expect, it } from "vitest"

import {
  getLegacyTransactionLinkFromBookingOrigin,
  toBookingOriginInsert,
} from "../../src/service-origin.js"

describe("booking origins", () => {
  it("normalizes the supported booking provenance targets", () => {
    const now = new Date("2026-06-13T12:00:00.000Z")

    const origin = toBookingOriginInsert(
      {
        bookingId: "book_1797",
        originSource: "accepted_quote_version",
        quoteVersionId: "qver_1797",
        tripSnapshotId: "trsn_1797",
        reservationPlanId: "trplan_1797",
        catalogPriceResponseId: "cquo_1797",
        catalogSnapshotId: "bcsn_1797",
        providerSourceKind: "voyant-connect",
        providerSourceProvider: "cruise-provider",
        providerSourceConnectionId: "src_conn_1797",
        providerSourceRef: "sailing_1797",
        providerOrderRef: "provider_order_1797",
        legacyTransactionOfferId: "off_legacy_1797",
        legacyTransactionOrderId: "ord_legacy_1797",
        metadata: { channel: "proposal" },
      },
      now,
    )

    expect(origin).toEqual({
      bookingId: "book_1797",
      originSource: "accepted_quote_version",
      quoteVersionId: "qver_1797",
      tripSnapshotId: "trsn_1797",
      reservationPlanId: "trplan_1797",
      catalogPriceResponseId: "cquo_1797",
      catalogSnapshotId: "bcsn_1797",
      providerSourceKind: "voyant-connect",
      providerSourceProvider: "cruise-provider",
      providerSourceConnectionId: "src_conn_1797",
      providerSourceRef: "sailing_1797",
      providerOrderRef: "provider_order_1797",
      legacyTransactionOfferId: "off_legacy_1797",
      legacyTransactionOrderId: "ord_legacy_1797",
      legacyTransactionIds: {
        offerId: "off_legacy_1797",
        orderId: "ord_legacy_1797",
      },
      metadata: { channel: "proposal" },
      createdAt: now,
      updatedAt: now,
    })
  })

  it("reads legacy transaction ids from origin records for compatibility sync", () => {
    const link = getLegacyTransactionLinkFromBookingOrigin({
      bookingId: "book_1797",
      originSource: "legacy_transaction",
      quoteVersionId: null,
      tripSnapshotId: null,
      reservationPlanId: null,
      catalogPriceResponseId: null,
      catalogSnapshotId: null,
      providerSourceKind: null,
      providerSourceProvider: null,
      providerSourceConnectionId: null,
      providerSourceRef: null,
      providerOrderRef: null,
      legacyTransactionOfferId: null,
      legacyTransactionOrderId: null,
      legacyTransactionIds: { offerId: "off_1797", orderId: "ord_1797" },
      metadata: null,
      createdAt: new Date("2026-06-13T12:00:00.000Z"),
      updatedAt: new Date("2026-06-13T12:00:00.000Z"),
    })

    expect(link).toEqual({ offerId: "off_1797", orderId: "ord_1797" })
  })
})
