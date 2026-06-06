import type { PublicCruiseSummary, PublicProduct } from "./types"

/**
 * A small in-memory catalog that mirrors what a DMC (Destination Management
 * Company) might expose via `/v1/public/products` after filtering by visibility.
 * Values are illustrative; amounts are in minor units (cents) to match the
 * Voyant finance convention.
 */
export const MOCK_PRODUCTS: readonly PublicProduct[] = [
  {
    id: "prod_01h2xfakemock00000000aaaa",
    name: "Amalfi Coast — 5 Day Classic",
    summary: "Lemon groves, pastel villages, and a private boat day off Positano.",
    description:
      "Base yourself in a cliffside hotel in Amalfi and explore Ravello, Positano, and Capri at your own pace. Includes airport transfers, daily breakfast, a guided walk of the Path of the Gods, and a half-day private boat charter.",
    destination: "Amalfi Coast, Italy",
    durationDays: 5,
    basePriceCents: 189_000,
    currency: "EUR",
    heroImage:
      "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=1200&q=60&auto=format&fit=crop",
    highlights: [
      "Cliffside boutique hotel in Amalfi",
      "Private boat charter along the coast",
      "Guided Path of the Gods hike",
      "Airport transfers and daily breakfast",
    ],
  },
  {
    id: "prod_01h2xfakemock00000000bbbb",
    name: "Kyoto Temples & Arashiyama",
    summary: "Quiet mornings at Fushimi Inari and a tea ceremony in Gion.",
    description:
      "A slow-paced 4-night introduction to Kyoto: Fushimi Inari at dawn, Arashiyama's bamboo grove before the crowds, Nishiki market, a private tea ceremony in Gion, and a day trip to Nara. Includes a licensed English-speaking guide on 3 of 4 days.",
    destination: "Kyoto, Japan",
    durationDays: 4,
    basePriceCents: 214_500,
    currency: "USD",
    heroImage:
      "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200&q=60&auto=format&fit=crop",
    highlights: [
      "Dawn visit to Fushimi Inari",
      "Private tea ceremony in Gion",
      "Day trip to Nara",
      "Licensed English-speaking guide",
    ],
  },
  {
    id: "prod_01h2xfakemock00000000cccc",
    name: "Patagonia Torres del Paine W-Trek",
    summary: "Seven days hiking the iconic W circuit with full refugio support.",
    description:
      "The classic W-trek across Torres del Paine National Park: Grey Glacier, the French Valley, and a sunrise at the Base of the Towers. Includes all refugio stays, breakfasts and dinners, park entrance fees, and catamaran crossings.",
    destination: "Patagonia, Chile",
    durationDays: 7,
    basePriceCents: 267_000,
    currency: "USD",
    heroImage:
      "https://images.unsplash.com/photo-1531794473797-9ceb0ac1a08b?w=1200&q=60&auto=format&fit=crop",
    highlights: [
      "All refugio accommodation",
      "Guided ascent to the Base of the Towers",
      "Grey Glacier catamaran crossing",
      "Daily breakfasts and dinners",
    ],
  },
  {
    id: "prod_01h2xfakemock00000000dddd",
    name: "Morocco High Atlas — Berber Villages",
    summary: "Trekking from Imlil through mountain villages to Mt. Toubkal.",
    description:
      "A 6-day Berber village trek starting in Imlil, winding through terraced fields and traditional kasbahs, ending with an optional summit of Jebel Toubkal (4,167m). Includes mule-supported porterage, half-board homestays, and a local certified mountain guide.",
    destination: "High Atlas, Morocco",
    durationDays: 6,
    basePriceCents: 132_500,
    currency: "EUR",
    heroImage:
      "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1200&q=60&auto=format&fit=crop",
    highlights: [
      "Certified local mountain guide",
      "Optional Mt. Toubkal summit",
      "Berber village homestays",
      "Mule-supported porterage",
    ],
  },
]

export function findMockProduct(id: string): PublicProduct | null {
  return MOCK_PRODUCTS.find((p) => p.id === id) ?? null
}

/**
 * A small mixed-source cruise catalog. Two local cruises (the operator's own
 * boutique boats) and one external cruise (sourced through an adapter such
 * as Voyant Connect, marked with `source: "external"` and a `sourceProvider`
 * the storefront uses to render a small badge).
 */
export const MOCK_CRUISES: readonly PublicCruiseSummary[] = [
  {
    id: "crsi_01h2xfakemock00000000aaaa",
    source: "local",
    sourceProvider: null,
    slug: "norwegian-fjords-7n-luxury",
    name: "Norwegian Fjords — 7 Night Luxury",
    cruiseType: "ocean",
    lineName: "Acme Cruises",
    shipName: "MV Acme Star",
    nights: 7,
    embarkPortName: "Bergen",
    disembarkPortName: "Bergen",
    regions: ["Northern Europe", "Norway"],
    themes: ["Scenic", "Wildlife"],
    earliestDeparture: "2026-06-15",
    latestDeparture: "2026-09-21",
    lowestPriceCents: 299900,
    lowestPriceCurrency: "USD",
    salesStatus: "open",
    heroImageUrl:
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&q=60&auto=format&fit=crop",
  },
  {
    id: "crsi_01h2xfakemock00000000bbbb",
    source: "local",
    sourceProvider: null,
    slug: "danube-river-8n",
    name: "Danube Discovery — 8 Night River",
    cruiseType: "river",
    lineName: "Acme River Cruises",
    shipName: "MV Acme Lyra",
    nights: 8,
    embarkPortName: "Budapest",
    disembarkPortName: "Passau",
    regions: ["Central Europe"],
    themes: ["Cultural", "Historic"],
    earliestDeparture: "2026-04-12",
    latestDeparture: "2026-10-25",
    lowestPriceCents: 345000,
    lowestPriceCurrency: "EUR",
    salesStatus: "open",
    heroImageUrl:
      "https://images.unsplash.com/photo-1549041008-e76ecbc4cc1d?w=1200&q=60&auto=format&fit=crop",
  },
  {
    id: "crsi_01h2xfakemock00000000cccc",
    source: "external",
    sourceProvider: "voyant-connect",
    slug: "antarctic-explorer-12n",
    name: "Antarctic Explorer — 12 Night Expedition",
    cruiseType: "expedition",
    lineName: "Polar Voyages",
    shipName: "MV Polar Pioneer",
    nights: 12,
    embarkPortName: "Ushuaia",
    disembarkPortName: "Ushuaia",
    regions: ["Antarctica", "South America"],
    themes: ["Polar", "Wildlife", "Photography"],
    earliestDeparture: "2026-11-20",
    latestDeparture: "2027-02-28",
    lowestPriceCents: 1250000,
    lowestPriceCurrency: "USD",
    salesStatus: "open",
    heroImageUrl:
      "https://images.unsplash.com/photo-1551722773-1f5e3d20fe39?w=1200&q=60&auto=format&fit=crop",
  },
]

export function findMockCruise(slug: string): PublicCruiseSummary | null {
  return MOCK_CRUISES.find((c) => c.slug === slug) ?? null
}
