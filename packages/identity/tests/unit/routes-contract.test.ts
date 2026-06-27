import type {
  identityAddresses,
  identityContactPoints,
  identityNamedContacts,
} from "@voyant-travel/identity/schema"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  addressSchema,
  contactPointSchema,
  namedContactSchema,
} from "../../src/routes/openapi-schemas.js"
import { identityRoutes } from "../../src/routes.js"

/**
 * Response contract tests (voyant#2114 — identity sub-batch) for the identity
 * admin routes. Each Drizzle-backed fixture is typed as the real `$inferSelect`
 * row so column drift breaks compilation; the JSON round-trip (Date → ISO
 * string) mirrors `c.json` so a declared/actual mismatch breaks the test. The
 * schemas mirror the response shapes declared in `routes.ts` (§17: `timestamp`
 * columns → strings; jsonb `metadata` bags are open records). The route legs are
 * asserted present so the dual-mount admin surface stays complete.
 */

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const contactPointRow: InferSelectModel<typeof identityContactPoints> = {
  id: "identity_contact_points_00000000000000000",
  entityType: "channel",
  entityId: "channels_00000000000000000000000000",
  kind: "email",
  label: null,
  value: "ops@acme.example",
  normalizedValue: "ops@acme.example",
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const addressRow: InferSelectModel<typeof identityAddresses> = {
  id: "identity_addresses_000000000000000000000",
  entityType: "channel",
  entityId: "channels_00000000000000000000000000",
  label: "billing",
  fullText: null,
  line1: "1 Main St",
  line2: null,
  city: "Lisbon",
  region: null,
  postalCode: "1000-001",
  country: "PT",
  latitude: 38.7223,
  longitude: -9.1393,
  timezone: "Europe/Lisbon",
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const namedContactRow: InferSelectModel<typeof identityNamedContacts> = {
  id: "identity_named_contacts_0000000000000000",
  entityType: "channel",
  entityId: "channels_00000000000000000000000000",
  role: "reservations",
  name: "Ada Lovelace",
  title: "Reservations Manager",
  email: "ada@acme.example",
  phone: null,
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const pagination = { total: 1, limit: 50, offset: 0 } as const

const cases: Array<{ name: string; row: object; schema: z.ZodTypeAny }> = [
  { name: "contact point", row: contactPointRow, schema: contactPointSchema },
  { name: "address", row: addressRow, schema: addressSchema },
  { name: "named contact", row: namedContactRow, schema: namedContactSchema },
]

describe("identity Drizzle-backed response contracts", () => {
  for (const { name, row, schema } of cases) {
    it(`the ${name} { data } envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })

    it(`the ${name} list envelope satisfies the declared schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row], ...pagination }))
      const parsed = z
        .object({
          data: z.array(schema),
          total: z.number().int(),
          limit: z.number().int(),
          offset: z.number().int(),
        })
        .safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("identity admin route legs", () => {
  const legs = (identityRoutes.routes as Array<{ method: string; path: string }>).map(
    (r) => `${r.method} ${r.path}`,
  )

  const expected = [
    "GET /contact-points",
    "POST /contact-points",
    "GET /contact-points/:id",
    "PATCH /contact-points/:id",
    "DELETE /contact-points/:id",
    "GET /addresses",
    "POST /addresses",
    "GET /addresses/:id",
    "PATCH /addresses/:id",
    "DELETE /addresses/:id",
    "GET /named-contacts",
    "POST /named-contacts",
    "GET /named-contacts/:id",
    "PATCH /named-contacts/:id",
    "DELETE /named-contacts/:id",
    "GET /entities/:entityType/:entityId/contact-points",
    "POST /entities/:entityType/:entityId/contact-points",
    "GET /entities/:entityType/:entityId/addresses",
    "POST /entities/:entityType/:entityId/addresses",
    "GET /entities/:entityType/:entityId/named-contacts",
    "POST /entities/:entityType/:entityId/named-contacts",
  ]

  for (const leg of expected) {
    it(`registers ${leg}`, () => {
      expect(legs).toContain(leg)
    })
  }
})
