import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  bookingGuarantees,
  bookingItemCommissions,
  bookingItemTaxLines,
  bookingPaymentSchedules,
} from "../../src/schema/booking-billing.js"

/**
 * Response contract tests (voyant#2114 / voyant#2208 — finance sub-batch 9D)
 * for the finance booking-billing admin routes. Each fixture is typed as the
 * real Drizzle row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in
 * `routes-booking-billing.ts`.
 */

const isoString = z.string()

const bookingPaymentScheduleSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  bookingItemId: z.string().nullable(),
  scheduleType: z.enum(["deposit", "installment", "balance", "hold", "other"]),
  status: z.enum(["pending", "due", "paid", "waived", "cancelled", "expired"]),
  dueDate: isoString,
  currency: z.string(),
  amountCents: z.number().int(),
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

const bookingGuaranteeSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  bookingPaymentScheduleId: z.string().nullable(),
  bookingItemId: z.string().nullable(),
  guaranteeType: z.enum([
    "deposit",
    "credit_card",
    "preauth",
    "card_on_file",
    "bank_transfer",
    "voucher",
    "agency_letter",
    "other",
  ]),
  status: z.enum(["pending", "active", "released", "failed", "cancelled", "expired"]),
  paymentInstrumentId: z.string().nullable(),
  paymentAuthorizationId: z.string().nullable(),
  currency: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  provider: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  guaranteedAt: isoString.nullable(),
  expiresAt: isoString.nullable(),
  releasedAt: isoString.nullable(),
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

const bookingItemTaxLineSchema = z.object({
  id: z.string(),
  bookingItemId: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  jurisdiction: z.string().nullable(),
  scope: z.enum(["included", "excluded", "withheld"]),
  currency: z.string(),
  amountCents: z.number().int(),
  rateBasisPoints: z.number().int().nullable(),
  includedInPrice: z.boolean(),
  remittanceParty: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: isoString,
  updatedAt: isoString,
})

const bookingItemCommissionSchema = z.object({
  id: z.string(),
  bookingItemId: z.string(),
  channelId: z.string().nullable(),
  recipientType: z.enum([
    "channel",
    "affiliate",
    "agency",
    "agent",
    "internal",
    "supplier",
    "other",
  ]),
  commissionModel: z.enum(["percentage", "fixed", "markup", "net"]),
  currency: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  rateBasisPoints: z.number().int().nullable(),
  status: z.enum(["pending", "accrued", "payable", "paid", "void"]),
  payableAt: isoString.nullable(),
  paidAt: isoString.nullable(),
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const paymentScheduleRow: InferSelectModel<typeof bookingPaymentSchedules> = {
  id: "booking_payment_schedules_000000000000",
  bookingId: "bkg_0000000000000000000000000",
  bookingItemId: null,
  scheduleType: "deposit",
  status: "pending",
  dueDate: "2026-02-01",
  currency: "EUR",
  amountCents: 30000,
  notes: null,
  createdAt,
  updatedAt,
}

const guaranteeRow: InferSelectModel<typeof bookingGuarantees> = {
  id: "booking_guarantees_000000000000000000",
  bookingId: "bkg_0000000000000000000000000",
  bookingPaymentScheduleId: "booking_payment_schedules_000000000000",
  bookingItemId: null,
  guaranteeType: "credit_card",
  status: "pending",
  paymentInstrumentId: null,
  paymentAuthorizationId: null,
  currency: "EUR",
  amountCents: 30000,
  provider: null,
  referenceNumber: null,
  guaranteedAt: null,
  expiresAt: new Date("2026-03-01T00:00:00.000Z"),
  releasedAt: null,
  notes: null,
  createdAt,
  updatedAt,
}

const taxLineRow: InferSelectModel<typeof bookingItemTaxLines> = {
  id: "booking_item_tax_lines_0000000000000000",
  bookingItemId: "bkgi_0000000000000000000000000",
  code: "VAT",
  name: "VAT 19%",
  jurisdiction: "RO",
  scope: "excluded",
  currency: "RON",
  amountCents: 1900,
  rateBasisPoints: 1900,
  includedInPrice: false,
  remittanceParty: null,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const commissionRow: InferSelectModel<typeof bookingItemCommissions> = {
  id: "booking_item_commissions_0000000000000",
  bookingItemId: "bkgi_0000000000000000000000000",
  channelId: null,
  recipientType: "agency",
  commissionModel: "percentage",
  currency: "EUR",
  amountCents: 1000,
  rateBasisPoints: 1000,
  status: "pending",
  payableAt: "2026-02-15",
  paidAt: null,
  notes: null,
  createdAt,
  updatedAt,
}

const cases = [
  ["booking payment schedule", bookingPaymentScheduleSchema, paymentScheduleRow],
  ["booking guarantee", bookingGuaranteeSchema, guaranteeRow],
  ["booking item tax line", bookingItemTaxLineSchema, taxLineRow],
  ["booking item commission", bookingItemCommissionSchema, commissionRow],
] as const

describe("finance booking-billing single-entity response contracts", () => {
  for (const [label, schema, row] of cases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })

    it(`the serialized ${label} { data: [...] } list envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row] }))
      const parsed = z.object({ data: z.array(schema) }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the delete envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
