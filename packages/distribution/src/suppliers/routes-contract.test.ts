import type { identityContactPoints } from "@voyant-travel/identity/schema"
import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { supplierContracts, supplierRates, supplierServices, suppliers } from "./schema.js"
import type { SupplierHydratedFields } from "./service-shared.js"

/**
 * Response contract tests (voyant#2114) for the supplier admin routes. Each
 * fixture is typed as the real row so column drift breaks compilation; the JSON
 * round-trip (Date → ISO string, `date` columns → strings, §17) mirrors `c.json`
 * so a declared/actual mismatch breaks the test. The schemas below mirror the
 * response shapes declared in `routes.ts`.
 */

const isoTimestamp = z.string()
const jsonRecordSchema = z.record(z.string(), z.unknown())

// Mirrors the hydrated `supplierSchema` in routes.ts (the supplier list returns
// the paginated envelope; single-entity returns a `{ data }` envelope).
const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  description: z.string().nullable(),
  defaultCurrency: z.string().nullable(),
  paymentTermsDays: z.number().int().nullable(),
  reservationTimeoutMinutes: z.number().int().nullable(),
  primaryFacilityId: z.string().nullable(),
  customerPaymentPolicy: z.unknown(),
  tags: z.array(z.string()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
})

// Mirrors `contactPointSchema` (identity-derived nested resource).
const contactPointSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  kind: z.string(),
  label: z.string().nullable(),
  value: z.string(),
  normalizedValue: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecordSchema.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const serviceSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  serviceType: z.string(),
  facilityId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  capacity: z.number().int().nullable(),
  active: z.boolean(),
  tags: z.array(z.string()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const rateSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  name: z.string(),
  currency: z.string(),
  amountCents: z.number().int(),
  unit: z.string(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  minPax: z.number().int().nullable(),
  maxPax: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
})

const contractSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  agreementNumber: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  renewalDate: z.string().nullable(),
  terms: z.string().nullable(),
  status: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const supplierRow: InferSelectModel<typeof suppliers> & SupplierHydratedFields = {
  id: "suppliers_0000000000000000000000000",
  name: "Acme Tours",
  type: "experience",
  status: "active",
  description: null,
  defaultCurrency: "EUR",
  paymentTermsDays: 30,
  reservationTimeoutMinutes: null,
  primaryFacilityId: null,
  customerPaymentPolicy: null,
  tags: ["preferred"],
  createdAt,
  updatedAt,
  email: "ops@acme.test",
  phone: null,
  website: null,
  address: null,
  city: null,
  country: "RO",
  contactName: "Ana Pop",
  contactEmail: null,
  contactPhone: null,
}

const contactPointRow: InferSelectModel<typeof identityContactPoints> = {
  id: "identity_contact_points_000000000000",
  entityType: "supplier",
  entityId: "suppliers_0000000000000000000000000",
  kind: "email",
  label: "Reservations",
  value: "res@acme.test",
  normalizedValue: "res@acme.test",
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const serviceRow: InferSelectModel<typeof supplierServices> = {
  id: "supplier_services_00000000000000000",
  supplierId: "suppliers_0000000000000000000000000",
  serviceType: "experience",
  facilityId: null,
  name: "City walking tour",
  description: null,
  duration: "PT2H",
  capacity: 12,
  active: true,
  tags: [],
  createdAt,
  updatedAt,
}

const rateRow: InferSelectModel<typeof supplierRates> = {
  id: "supplier_rates_00000000000000000000",
  serviceId: "supplier_services_00000000000000000",
  name: "Standard",
  currency: "EUR",
  amountCents: 4500,
  unit: "per_person",
  validFrom: "2026-06-01",
  validTo: "2026-09-30",
  minPax: 1,
  maxPax: 12,
  notes: null,
  createdAt,
}

const contractRow: InferSelectModel<typeof supplierContracts> = {
  id: "supplier_contracts_0000000000000000",
  supplierId: "suppliers_0000000000000000000000000",
  agreementNumber: "AGR-2026-01",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  renewalDate: null,
  terms: null,
  status: "active",
  createdAt,
  updatedAt,
}

const singleCases = [
  ["supplier", supplierSchema, supplierRow],
  ["contact point", contactPointSchema, contactPointRow],
  ["service", serviceSchema, serviceRow],
  ["rate", rateSchema, rateRow],
  ["contract", contractSchema, contractRow],
] as const

describe("supplier single-entity response contracts", () => {
  for (const [label, schema, row] of singleCases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("supplier list response contracts", () => {
  it("the serialized supplier list satisfies the declared OpenAPI list envelope", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([supplierRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(supplierSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized nested contact-point array { data } envelope satisfies the schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [contactPointRow] }))
    const parsed = z.object({ data: z.array(contactPointSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delete envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
