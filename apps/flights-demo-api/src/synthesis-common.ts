import type { CabinClass, FlightSearchRequest, Itinerary } from "@voyantjs/flights/contract/types"

export interface DemoCarrier {
  code: string
  hubs: string[]
  basePriceMultiplier: number
}

/**
 * Hand-picked carrier set with a primary hub city; the demo adapter uses
 * the hub to decide which itineraries route via that carrier (so e.g.
 * AA tends to route via DFW, BA via LHR). All codes match reference
 * data already seeded into Postgres.
 */
export const CARRIERS: DemoCarrier[] = [
  { code: "BA", hubs: ["LHR"], basePriceMultiplier: 1.05 },
  { code: "AF", hubs: ["CDG"], basePriceMultiplier: 1.0 },
  { code: "KL", hubs: ["AMS"], basePriceMultiplier: 1.0 },
  { code: "LH", hubs: ["FRA", "MUC"], basePriceMultiplier: 1.05 },
  { code: "AA", hubs: ["DFW", "JFK"], basePriceMultiplier: 0.95 },
  { code: "DL", hubs: ["ATL"], basePriceMultiplier: 0.95 },
  { code: "UA", hubs: ["IAD", "SFO"], basePriceMultiplier: 0.95 },
  { code: "EK", hubs: ["DXB"], basePriceMultiplier: 1.15 },
  { code: "QR", hubs: ["DOH"], basePriceMultiplier: 1.1 },
  { code: "SQ", hubs: ["SIN"], basePriceMultiplier: 1.2 },
  { code: "AY", hubs: ["HEL"], basePriceMultiplier: 0.9 },
  { code: "U2", hubs: ["LGW"], basePriceMultiplier: 0.6 },
  { code: "FR", hubs: ["STN"], basePriceMultiplier: 0.55 },
]

export const CABIN_PRICE_MULT: Record<CabinClass, number> = {
  economy: 1,
  premium_economy: 1.6,
  business: 3.5,
  first: 6.0,
}

export const AIRCRAFT_TYPES = ["738", "32A", "320", "321", "77W", "788", "789", "359", "351", "388"]

export function durationOfItinerary(itin: Itinerary): number | null {
  const first = itin.segments[0]
  const last = itin.segments[itin.segments.length - 1]
  if (!first || !last) return null
  const ms = new Date(last.arrival.at).getTime() - new Date(first.departure.at).getTime()
  return Number.isFinite(ms) ? Math.round(ms / 60_000) : null
}

export function setHourMinute(dateIso: string, hour: number, minute: number): Date {
  // Treat date as local midnight UTC to keep determinism timezone-agnostic.
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCHours(hour, minute, 0, 0)
  return d
}

export function minutesToIso8601(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}` || "PT0M"
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + n)
  return copy
}

/**
 * Tiny 32-bit PRNG (Mulberry32). Deterministic from a seed — matches what
 * other demo generators in the codebase use so behavior is comparable.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function hashRequest(request: Omit<FlightSearchRequest, "pagination">): number {
  const key = JSON.stringify({
    s: request.slices,
    p: request.passengers,
    c: request.cabin ?? "economy",
  })
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

export function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return hash >>> 0
}
