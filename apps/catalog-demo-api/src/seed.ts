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

/**
 * Generate ISO timestamps for upcoming departures relative to "now".
 * Each call returns dates `daysAheadList[i]` days from today at the
 * specified `hour:minute` (UTC). Keeps the demo always-future without
 * the seed needing to be re-run on a schedule.
 */
function futureDepartures(
  daysAheadList: number[],
  hour: number,
  minute: number,
  durationMinutes: number,
  capacity: number,
): Array<{
  id: string
  starts_at: string
  ends_at: string
  status: "open"
  capacity: number
  remaining: number
}> {
  const now = new Date()
  const bookedPattern = [0, 1, 2, 3, 0, 2, 4, 1]
  return daysAheadList.map((daysAhead, idx) => {
    const start = new Date(now)
    start.setUTCDate(start.getUTCDate() + daysAhead)
    start.setUTCHours(hour, minute, 0, 0)
    const end = new Date(start.getTime() + durationMinutes * 60_000)
    const booked = Math.min(bookedPattern[idx % bookedPattern.length] ?? 0, capacity - 1)
    return {
      id: `dep_${idx + 1}`,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "open",
      capacity,
      remaining: capacity - booked,
    }
  })
}

/**
 * Rich content for each demo product, stored in the `metadata` JSONB
 * column. The `/get-content` endpoint pulls this and projects it as
 * a `ProductContent` payload — same shape the products vertical's
 * content cache expects. Real upstream adapters (TUI, Hotelbeds,
 * Voyant Connect peers) keep this in their own DB and serve it via
 * their content API; the demo mirrors that posture.
 *
 * Wrapped in a function so departure timestamps are computed relative
 * to "now" on every seed run — keeps the demo always showing
 * upcoming dates without re-authoring the seed.
 */
export function buildDefaultDemoInventory(): ReadonlyArray<DemoInventoryInput> {
  return defaultDemoInventoryRaw()
}

/**
 * Static reference for code paths that don't want a fresh seed.
 * Equivalent to `buildDefaultDemoInventory()` but evaluated at
 * module-load time, so departure dates may be stale if the process
 * has been running a while.
 */
export const defaultDemoInventory: ReadonlyArray<DemoInventoryInput> = buildDefaultDemoInventory()

function defaultDemoInventoryRaw(): ReadonlyArray<DemoInventoryInput> {
  return [
    {
      name: "Demo · Lisbon Sunset Catamaran",
      description:
        "Two-hour catamaran cruise along the Tagus at golden hour, with onboard bar and live DJ. Sample upstream inventory feed.",
      priceCents: 6500,
      currency: "EUR",
      available: 8,
      metadata: {
        highlights: [
          "Front-row sunset over the 25 de Abril Bridge",
          "Welcome drink + tapas board on board",
          "Live DJ set, dance floor on deck",
        ],
        heroImageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
        country: "PT",
        departureCity: "Lisbon",
        tags: ["lisbon", "cruise", "sunset", "evening"],
        durationDays: 1,
        cancellationPolicy:
          "Free cancellation up to 24 hours before departure. After that, no refund.",
        paymentTerms: "Pay in full at booking. Card or PayPal.",
        days: [
          {
            dayNumber: 1,
            title: "Embarkation at Doca de Alcântara",
            description:
              "Meet the crew at 17:30 for boarding. Quick safety briefing then we cast off as the city catches the last light.",
            location: "Doca de Alcântara, Lisbon",
          },
        ],
        options: [
          {
            id: "opt_standard",
            name: "Standard cabin spot",
            description: "Shared catamaran with 28 guests max. Includes welcome drink + tapas.",
          },
          {
            id: "opt_vip",
            name: "VIP front-deck table",
            description:
              "Reserved 4-seat table at the bow. Private waiter, premium drinks pairing.",
          },
        ],
        media: [
          {
            url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200",
            type: "image",
            caption: "Sunset over the bridge",
          },
          {
            url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200",
            type: "image",
            caption: "Catamaran on the Tagus",
          },
        ],
        departures: futureDepartures([1, 2, 3, 4, 5, 7, 9, 12], 17, 30, 120, 28),
      },
    },
    {
      name: "Demo · Tuscany Truffle Hunt",
      description:
        "Half-day truffle hunt with a third-generation hunter and his trained dogs, finishing with a four-course tasting lunch.",
      priceCents: 18500,
      currency: "EUR",
      available: 4,
      metadata: {
        highlights: [
          "Forage with a master hunter and his Lagotto dogs",
          "Four-course truffle-paired tasting lunch",
          "Glass of Brunello with the chef's compliments",
        ],
        heroImageUrl: "https://images.unsplash.com/photo-1564759191972-a96b1c7e3d6f?w=800",
        country: "IT",
        departureCity: "San Miniato",
        tags: ["tuscany", "food", "guided", "half-day"],
        durationDays: 1,
        cancellationPolicy:
          "Free cancellation up to 7 days before. 50% refund within 7 days. No refund within 24 hours.",
        paymentTerms: "30% deposit at booking, balance 7 days before.",
        days: [
          {
            dayNumber: 1,
            title: "Forest hunt with the dogs",
            description:
              "9:00 — meet at the hunter's farmhouse. Briefing, boots check, then into the woods with the Lagotto pack.",
            location: "San Miniato hills, Tuscany",
          },
        ],
        options: [
          {
            id: "opt_group",
            name: "Group hunt (up to 6)",
            description:
              "Shared hunt with other small parties. Lunch in the farmhouse dining room.",
          },
          {
            id: "opt_private",
            name: "Private hunt + chef visit",
            description: "Just your party. Chef joins your table for the wine pairing course.",
          },
        ],
        media: [
          {
            url: "https://images.unsplash.com/photo-1564759191972-a96b1c7e3d6f?w=1200",
            type: "image",
            caption: "Truffle hunt with Lagotto",
          },
        ],
        departures: futureDepartures([3, 5, 8, 10, 14, 17, 21], 9, 0, 240, 6),
      },
    },
    {
      name: "Demo · Reykjavík Northern Lights Hunt",
      description:
        "Small-group minibus tour chasing the aurora, leaving every clear evening from October to March. Hot chocolate and photos included.",
      priceCents: 9900,
      currency: "EUR",
      available: 12,
      metadata: {
        highlights: [
          "Up to 4 hours of aurora chasing in a comfortable minibus",
          "Free re-tour if the aurora doesn't show on your night",
          "Photographer-guide takes your portrait under the lights",
        ],
        heroImageUrl: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=800",
        country: "IS",
        departureCity: "Reykjavík",
        tags: ["iceland", "aurora", "evening", "guided", "winter"],
        durationDays: 1,
        cancellationPolicy:
          "Free cancellation up to 24 hours before pickup. Within 24h: 50% refund. No refund for no-shows.",
        paymentTerms: "Pay at booking. Card or bank transfer.",
        days: [
          {
            dayNumber: 1,
            title: "Departure + aurora chase",
            description:
              "20:30 pickup from your hotel. We pick the best forecast spot of the night and chase for up to 4 hours.",
            location: "Greater Reykjavík + countryside",
          },
        ],
        options: [
          {
            id: "opt_standard",
            name: "Standard minibus",
            description: "Up to 19 guests. Hot chocolate, blankets, return by 01:00.",
          },
          {
            id: "opt_premium",
            name: "Premium small-group (max 8)",
            description:
              "Smaller bus, more flexibility, longer chase window if conditions need it.",
          },
        ],
        media: [
          {
            url: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=1200",
            type: "image",
            caption: "Aurora over the countryside",
          },
          {
            url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200",
            type: "image",
            caption: "Photographer-guide setting up",
          },
        ],
        departures: futureDepartures([2, 3, 4, 6, 8, 11, 14, 18], 20, 30, 270, 19),
      },
    },
  ]
}

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
      // Re-seed: update mutable fields so a new metadata payload picks
      // up on the next run. Idempotent in the inert case (same values
      // → no-op write). The id stays the same so existing
      // catalog_sourced_entries rows don't orphan.
      const updated = (await db
        .update(catalogDemoInventory)
        .set({
          description: row.description ?? null,
          priceCents: row.priceCents,
          currency: row.currency ?? "EUR",
          available: row.available ?? existing[0].available,
          entityModule: row.entityModule ?? existing[0].entityModule,
          metadata: row.metadata ?? existing[0].metadata,
          updatedAt: new Date(),
        })
        .where(eq(catalogDemoInventory.id, existing[0].id))
        .returning()) as CatalogDemoInventoryRow[]
      out.push(updated[0] ?? existing[0])
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
