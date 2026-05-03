/**
 * Seed helper for the demo adapter.
 *
 * Templates that register the demo adapter call this once at first boot
 * (or from a `pnpm seed` script) to populate `catalog_demo_inventory`
 * with a small set of realistic rows. Without seeded inventory the
 * adapter is alive but the catalog UI shows nothing under
 * `source = Demo` — bad first impression.
 *
 * Idempotent on `name` — re-runs are safe and won't duplicate rows.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { newId } from "@voyantjs/db/lib/typeid"
import { eq } from "drizzle-orm"

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

/**
 * Insert demo inventory rows, skipping any name that already exists.
 * Returns the full set of rows present after the seed (existing + newly
 * inserted) so callers can wire follow-up data to the ids.
 */
export async function seedDemoInventory(
  db: AnyDrizzleDb,
  rows: ReadonlyArray<DemoInventoryInput>,
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

/**
 * The default starter set. Templates that don't want to author their own
 * inventory call `seedDemoInventory(db, defaultDemoInventory)`. Three
 * rows is enough to demonstrate `source = Demo` filtering on the catalog
 * page without crowding the UI.
 */
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
