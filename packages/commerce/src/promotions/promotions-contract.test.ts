import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { promotionalOffers } from "./schema.js"
import { promotionalOfferSchema } from "./validation.js"

/**
 * Response contract test (voyant#2114) — the promotions admin list route's
 * declared OpenAPI response schema must match what `listOffers` actually
 * returns. The fixture is typed as the real Drizzle row (column drift breaks
 * compilation); the JSON round-trip (numeric → string, Date → ISO string)
 * mirrors `c.json` so a declared/actual mismatch breaks the test.
 */
const row: InferSelectModel<typeof promotionalOffers> = {
  id: "promo_0000000000000000000000",
  name: "Summer sale",
  slug: "summer-sale",
  description: null,
  discountType: "percentage",
  discountPercent: "10.00",
  discountAmountCents: null,
  currency: null,
  scope: { kind: "global" },
  conditions: { minPax: 2 },
  validFrom: new Date("2026-06-01T00:00:00.000Z"),
  validUntil: null,
  code: null,
  stackable: false,
  active: true,
  metadata: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

describe("promotions list response contract", () => {
  it("the serialized wire response satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify(listResponse([row], { total: 1, limit: 50, offset: 0 })))
    const parsed = listResponseSchema(promotionalOfferSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("promotions detail response contract", () => {
  // The create / detail / update / archive admin legs all return a single
  // `{ data: offer }` envelope (voyant#2114); the round-trip mirrors `c.json`
  // so a declared/actual mismatch breaks the test.
  const offerEnvelopeSchema = z.object({ data: promotionalOfferSchema })

  it("the serialized single-offer envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: row }))
    const parsed = offerEnvelopeSchema.safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized delete envelope satisfies the declared OpenAPI schema", () => {
    const deleteEnvelopeSchema = z.object({ data: z.object({ id: z.string() }) })
    const wire = JSON.parse(JSON.stringify({ data: { id: row.id } }))
    const parsed = deleteEnvelopeSchema.safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
