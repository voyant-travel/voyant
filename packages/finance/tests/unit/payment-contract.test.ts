import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  paymentAuthorizationSchema,
  paymentCaptureSchema,
  paymentInstrumentSchema,
  supplierPaymentSchema,
  travelCreditRedemptionSchema,
  travelCreditSchema,
} from "../../src/routes-payment-schemas.js"
import type { paymentInstruments } from "../../src/schema/payment-instruments.js"
import type { paymentAuthorizations, paymentCaptures } from "../../src/schema/payment-processing.js"
import type { supplierPayments } from "../../src/schema/supplier-invoices.js"
import type { travelCreditRedemptions, travelCredits } from "../../src/schema/travel-credits.js"

/**
 * Response contract tests (voyant#2114 / voyant#2208 — finance sub-batch 9C)
 * for the finance payments admin routes. Each fixture is typed as the real
 * Drizzle row so column drift breaks compilation; the JSON round-trip (Date →
 * ISO string, `date` columns already strings) mirrors `c.json` so a
 * declared/actual mismatch breaks the test. The schemas under test are the
 * ones declared in `routes-payment-schemas.ts`.
 */

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const supplierPaymentRow: InferSelectModel<typeof supplierPayments> = {
  id: "supplier_payments_0000000000000000000",
  bookingId: "bookings_000000000000000000000000000",
  supplierId: "suppliers_00000000000000000000000000",
  bookingSupplierStatusId: null,
  supplierInvoiceId: null,
  amountCents: 50000,
  currency: "EUR",
  baseCurrency: "EUR",
  baseAmountCents: 50000,
  fxRateSetId: null,
  paymentMethod: "bank_transfer",
  paymentInstrumentId: null,
  status: "completed",
  referenceNumber: "WIRE-123",
  paymentDate: "2026-01-01",
  notes: null,
  createdAt,
  updatedAt,
}

const paymentInstrumentRow: InferSelectModel<typeof paymentInstruments> = {
  id: "payment_instruments_000000000000000000",
  ownerType: "client",
  personId: null,
  organizationId: null,
  supplierId: null,
  channelId: null,
  instrumentType: "credit_card",
  status: "active",
  label: "Visa •••• 4242",
  provider: "stripe",
  brand: "visa",
  last4: "4242",
  holderName: "Jane Traveller",
  expiryMonth: 12,
  expiryYear: 2030,
  externalToken: null,
  externalCustomerId: null,
  billingEmail: null,
  billingAddress: null,
  directBillReference: null,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const paymentAuthorizationRow: InferSelectModel<typeof paymentAuthorizations> = {
  id: "payment_authorizations_0000000000000000",
  bookingId: null,
  orderId: null,
  invoiceId: "invoices_0000000000000000000000000000",
  bookingGuaranteeId: null,
  paymentInstrumentId: paymentInstrumentRow.id,
  status: "authorized",
  captureMode: "manual",
  currency: "EUR",
  amountCents: 11900,
  provider: "stripe",
  externalAuthorizationId: "auth_123",
  approvalCode: "OK123",
  authorizedAt: createdAt,
  expiresAt: null,
  voidedAt: null,
  notes: null,
  createdAt,
  updatedAt,
}

const paymentCaptureRow: InferSelectModel<typeof paymentCaptures> = {
  id: "payment_captures_00000000000000000000",
  paymentAuthorizationId: paymentAuthorizationRow.id,
  invoiceId: "invoices_0000000000000000000000000000",
  status: "completed",
  currency: "EUR",
  amountCents: 11900,
  provider: "stripe",
  externalCaptureId: "cap_123",
  capturedAt: createdAt,
  settledAt: null,
  notes: null,
  createdAt,
  updatedAt,
}

const travelCreditRow: InferSelectModel<typeof travelCredits> = {
  id: "travel_credits_000000000000000000000000000",
  code: "GIFT-2026-0001",
  seriesCode: "GIFT-2026-Q1",
  status: "active",
  currency: "EUR",
  initialAmountCents: 10000,
  remainingAmountCents: 10000,
  issuedToPersonId: null,
  issuedToOrganizationId: null,
  sourceType: "gift",
  sourceBookingId: null,
  sourcePaymentId: null,
  validFrom: null,
  expiresAt: null,
  notes: null,
  issuedByUserId: null,
  createdAt,
  updatedAt,
}

const travelCreditRedemptionRow: InferSelectModel<typeof travelCreditRedemptions> = {
  id: "travel_credit_redemptions_000000000000000000",
  travelCreditId: travelCreditRow.id,
  bookingId: "bookings_000000000000000000000000000",
  paymentId: null,
  idempotencyKey: "redeem-1",
  amountCents: 2500,
  createdAt,
  createdByUserId: null,
}

const singleCases = [
  ["supplier payment", supplierPaymentSchema, supplierPaymentRow],
  ["payment instrument", paymentInstrumentSchema, paymentInstrumentRow],
  ["payment authorization", paymentAuthorizationSchema, paymentAuthorizationRow],
  ["payment capture", paymentCaptureSchema, paymentCaptureRow],
  ["travel credit", travelCreditSchema, travelCreditRow],
  ["travel credit redemption", travelCreditRedemptionSchema, travelCreditRedemptionRow],
] as const

describe("finance payment single-entity response contracts", () => {
  for (const [label, schema, row] of singleCases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("finance payment list response contracts", () => {
  it("the serialized supplier-payment list satisfies the declared envelope schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([supplierPaymentRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(supplierPaymentSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized travel credit list satisfies the declared envelope schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([travelCreditRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(travelCreditSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("finance travel credit redeem-result response contract", () => {
  it("the serialized { travelCredit, redemption } result satisfies the declared schema", () => {
    const wire = JSON.parse(
      JSON.stringify({
        data: { travelCredit: travelCreditRow, redemption: travelCreditRedemptionRow },
      }),
    )
    const parsed = z
      .object({
        data: z.object({
          travelCredit: travelCreditSchema,
          redemption: travelCreditRedemptionSchema.nullable(),
        }),
      })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
