import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import type { markets } from "./schema.js"
import { marketSchema } from "./validation.js"

/**
 * Response contract test (voyant#2114) — closes the gap that `@hono/zod-openapi`
 * leaves open (honojs/middleware#181): the library keeps the generated doc in
 * sync with the *declared* response schema, but does NOT verify that the handler
 * actually returns that shape. Without this, a wrong response schema (the
 * platform#645 class) would still generate a clean — but lying — doc.
 *
 * The fixture is typed as the real Drizzle select row, so a column drift breaks
 * compilation; the assertion validates the JSON-serialized wire payload (Date →
 * ISO string, the same transform `c.json` applies) against `marketSchema`, so a
 * declared/actual mismatch breaks the test.
 */
const row: InferSelectModel<typeof markets> = {
  id: "mkt_0000000000000000000000",
  code: "RO",
  name: "Romania",
  status: "active",
  regionCode: null,
  countryCode: "RO",
  defaultLanguageTag: "ro-RO",
  defaultCurrency: "RON",
  timezone: null,
  taxContext: null,
  metadata: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

describe("markets list response contract", () => {
  it("the serialized wire response satisfies the declared OpenAPI schema", () => {
    const envelope = listResponse([row], { total: 1, limit: 50, offset: 0 })
    // Round-trip through JSON to mirror Hono's `c.json` serialization.
    const wire = JSON.parse(JSON.stringify(envelope))
    const parsed = listResponseSchema(marketSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
