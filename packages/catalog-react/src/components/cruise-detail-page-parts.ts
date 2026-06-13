import type { CatalogUiMessages } from "../i18n/messages.js"

export interface CruiseSailing {
  id: string | null
  sourceRef: string | null
  startDate: string | null
  endDate: string | null
  nights: number | null
  status: string | null
  embarkationPort: string | null
  disembarkationPort: string | null
  lowestPriceCents: number | null
  currency: string | null
}

export interface CruiseCabin {
  id: string
  /** Provider cabin code (e.g. `omi_V`) — joins to live pricing rows. */
  externalId: string | null
  name: string
  type: string | null
  view: string | null
  squareFeet: string | null
  capacityMin: number | null
  capacityMax: number | null
  images: string[]
  inclusions: string[]
}

export interface CabinPrice {
  code: string
  fromAmountMinor: number
  available: boolean
}

export interface CruiseStop {
  dayNumber: number | null
  date: string | null
  portName: string | null
  arrivalTime: string | null
  departureTime: string | null
  isAtSea: boolean
  description: string | null
}

export interface CruiseDetail {
  name: string | null
  description: string | null
  cruiseType: string | null
  cruiseLine: string | null
  nights: number | null
  heroImageUrl: string | null
  highlights: string[]
  embarkationPort: string | null
  disembarkationPort: string | null
  ship: {
    name: string | null
    shipType: string | null
    description: string | null
    capacity: number | null
    decks: number | null
    yearBuilt: number | null
    gallery: string[]
  } | null
  sailings: CruiseSailing[]
  cabins: CruiseCabin[]
  itinerary: CruiseStop[]
}

export type SearchMessages = CatalogUiMessages["catalogBrowser"]["search"]

// ── Content mapping (Connect cruise content → render shape) ─────────────────
export function mapCruiseContent(content: unknown): CruiseDetail | null {
  const c = asRecord(content)
  const cruise = asRecord(c?.cruise)
  if (!cruise) return null
  const ship = asRecord(c?.ship)
  const sailingsRaw = Array.isArray(c?.sailings) ? c.sailings : []
  const cabinsRaw = Array.isArray(c?.cabin_categories) ? c.cabin_categories : []
  const stopsRaw = Array.isArray(c?.itinerary_stops) ? c.itinerary_stops : []
  return {
    name: asStr(cruise.name),
    description: asStr(cruise.description),
    cruiseType: asStr(cruise.cruise_type),
    cruiseLine: asStr(cruise.cruise_line),
    nights: asNum(cruise.duration_nights),
    heroImageUrl: asStr(cruise.hero_image_url),
    highlights: asStrArray(cruise.highlights),
    embarkationPort: asStr(cruise.embarkation_port),
    disembarkationPort: asStr(cruise.disembarkation_port),
    ship: ship
      ? {
          name: asStr(ship.name),
          shipType: asStr(ship.ship_type),
          description: asStr(ship.description),
          capacity: asNum(ship.capacity),
          decks: asNum(ship.decks),
          yearBuilt: asNum(ship.year_built),
          gallery: asStrArray(ship.gallery),
        }
      : null,
    sailings: sailingsRaw.map((row) => {
      const r = asRecord(row) ?? {}
      return {
        id: asStr(r.id),
        sourceRef: asStr(r.source_ref),
        startDate: asStr(r.start_date),
        endDate: asStr(r.end_date),
        nights: asNum(r.duration_nights),
        status: asStr(r.status),
        embarkationPort: asStr(r.embarkation_port),
        disembarkationPort: asStr(r.disembarkation_port),
        lowestPriceCents: asNum(r.lowest_price_cents),
        currency: asStr(r.currency),
      }
    }),
    cabins: cabinsRaw.map((row, i) => {
      const r = asRecord(row) ?? {}
      return {
        id: asStr(r.id) ?? `cabin-${i}`,
        externalId: decodeCatalogExternalId(asStr(r.id)),
        // Pure mapper, no messages in scope; "Cabin" is a last-resort fallback for an unnamed upstream cabin, not chrome copy.
        // i18n-literal-ok
        name: asStr(r.name) ?? asStr(r.code) ?? "Cabin",
        type: asStr(r.type),
        view: asStr(r.view_type) ?? asStr(r.type),
        squareFeet: asStr(r.square_feet),
        capacityMin: asNum(r.capacity_min),
        capacityMax: asNum(r.capacity_max),
        images: asStrArray(r.images),
        inclusions: asStrArray(r.inclusions),
      }
    }),
    itinerary: stopsRaw.map((row) => {
      const r = asRecord(row) ?? {}
      return {
        dayNumber: asNum(r.day_number),
        date: asStr(r.date),
        portName: asStr(r.port_name),
        arrivalTime: asStr(r.arrival_time),
        departureTime: asStr(r.departure_time),
        isAtSea: r.is_at_sea === true,
        description: asStr(r.description),
      }
    }),
  }
}

export function formatCruiseType(type: string | null, s: SearchMessages): string | null {
  if (type === "river") return s.typeRiver
  if (type === "ocean") return s.typeOcean
  return type
}

export function formatMoney(m: { amountMinor: number; currency: string }, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: 0,
  }).format(m.amountMinor / 100)
}

export function formatDay(iso: string | null, locale?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
}

// Catalog ids are `<prefix>_sr_<base64url(JSON{externalId,…})>`; pull the
// provider externalId so cabins can join to live pricing rows.
function decodeCatalogExternalId(id: string | null): string | null {
  if (!id) return null
  const idx = id.indexOf("_sr_")
  if (idx < 0) return null
  try {
    const b64 = id
      .slice(idx + 4)
      .replace(/-/g, "+")
      .replace(/_/g, "/")
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    const obj = JSON.parse(atob(padded)) as { externalId?: string }
    return typeof obj.externalId === "string" ? obj.externalId : null
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
function asStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return null
}
function asStrArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : []
}
