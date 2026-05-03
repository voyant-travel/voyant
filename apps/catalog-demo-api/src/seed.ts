/**
 * Default starter inventory for the demo service. Idempotent on `name`.
 * Three rows is enough to demonstrate the booking lifecycle without
 * crowding the UI; templates that want more author their own.
 */

import { newId } from "@voyantjs/db/lib/typeid"
import { eq } from "drizzle-orm"

import type { CatalogDemoDb } from "./db.js"
import { type CatalogDemoInventoryRow, catalogDemoInventory } from "./schema.js"

export interface DemoInventoryInput {
  name: string
  description?: string
  priceCents: number
  currency?: string
  available?: number
  entityModule?: string
  metadata?: Record<string, unknown>
}

export const defaultDemoInventory: ReadonlyArray<DemoInventoryInput> = [
  {
    name: "Demo · Lisbon Sunset Catamaran",
    description:
      "Two-hour catamaran cruise along the Tagus at golden hour, with onboard bar and live DJ. Sample upstream inventory feed.",
    priceCents: 6500,
    currency: "EUR",
    available: 8,
  },
  {
    name: "Demo · Tuscany Truffle Hunt",
    description:
      "Half-day truffle hunt with a third-generation hunter and his trained dogs, finishing with a four-course tasting lunch.",
    priceCents: 18500,
    currency: "EUR",
    available: 4,
  },
  {
    name: "Demo · Reykjavík Northern Lights Hunt",
    description:
      "Small-group minibus tour chasing the aurora, leaving every clear evening from October to March. Hot chocolate and photos included.",
    priceCents: 9900,
    currency: "EUR",
    available: 12,
  },
]

export async function seedInventory(
  db: CatalogDemoDb,
  rows: ReadonlyArray<DemoInventoryInput> = defaultDemoInventory,
): Promise<CatalogDemoInventoryRow[]> {
  const out: CatalogDemoInventoryRow[] = []
  for (const row of rows) {
    const existing = await db
      .select()
      .from(catalogDemoInventory)
      .where(eq(catalogDemoInventory.name, row.name))
      .limit(1)
    if (existing[0]) {
      out.push(existing[0])
      continue
    }
    const inserted = (await db
      .insert(catalogDemoInventory)
      .values({
        id: newId("catalog_demo_inventory"),
        name: row.name,
        description: row.description ?? null,
        priceCents: row.priceCents,
        currency: row.currency ?? "EUR",
        available: row.available ?? 5,
        entityModule: row.entityModule ?? "products",
        metadata: row.metadata ?? null,
      })
      .returning()) as CatalogDemoInventoryRow[]
    if (inserted[0]) out.push(inserted[0])
  }
  return out
}
