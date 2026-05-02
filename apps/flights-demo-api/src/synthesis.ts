/**
 * Pure synthesis helpers for the demo flight service. Generates
 * deterministic `FlightOffer`s, `FlightOrder`s, ancillary catalogs, and
 * seat maps so the booking journey works end-to-end without an upstream
 * GDS. Hashes each request to seed a tiny PRNG, so the same search
 * returns the same offers across reloads (stable deep-links).
 *
 * No DB access — persistence + the HTTP surface live in `./store.ts` and
 * `./routes.ts`. The plugin client (`@voyantjs/plugin-flights-demo`) is a
 * thin HTTP wrapper around those routes.
 */

import type {
  AncillaryAssistanceOption,
  AncillaryBaggageOption,
  AncillaryCatalog,
  AncillaryExtraOption,
  AncillarySelection,
  CabinClass,
  FareBreakdown,
  FareBundle,
  FlightBookRequest,
  FlightOffer,
  FlightOrder,
  FlightSearchRequest,
  FlightSegment,
  FlightSlice,
  FlightTicket,
  Itinerary,
  Seat,
  SeatMap,
  SeatRow,
} from "@voyantjs/flights/contract/types"

// ─────────────────────────────────────────────────────────────────────────────
// Carrier table — IATA codes the demo cycles through
// ─────────────────────────────────────────────────────────────────────────────

interface DemoCarrier {
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
const CARRIERS: DemoCarrier[] = [
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

const CABIN_PRICE_MULT: Record<CabinClass, number> = {
  economy: 1,
  premium_economy: 1.6,
  business: 3.5,
  first: 6.0,
}

const AIRCRAFT_TYPES = ["738", "32A", "320", "321", "77W", "788", "789", "359", "351", "388"]
// ─────────────────────────────────────────────────────────────────────────────
// Generator — deterministic per request hash
// ─────────────────────────────────────────────────────────────────────────────

/** Total offer pool generated per route — server applies filters + pagination. */
const POOL_SIZE = 32
/** Default page size when caller omits pagination.limit. */
const _DEFAULT_PAGE_SIZE = 20

export function synthesizeOffers(request: FlightSearchRequest): FlightOffer[] {
  // Hash without pagination so the same route produces the same pool across
  // page navigations — pagination is applied as a slice on top of the pool.
  const { pagination: _ignored, ...rest } = request
  const seed = hashRequest(rest)
  const rand = mulberry32(seed)
  const cabin = request.cabin ?? "economy"

  const offers: FlightOffer[] = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const carrier = CARRIERS[Math.floor(rand() * CARRIERS.length)]
    if (!carrier) continue

    // Stops: 60% nonstop, 30% one-stop, 10% two-stop. Low-cost carriers
    // (U2, FR) skew nonstop for short-haul.
    const stopsRoll = rand()
    let stops = 0
    if (carrier.basePriceMultiplier > 0.7) {
      if (stopsRoll > 0.4 && stopsRoll <= 0.7) stops = 1
      else if (stopsRoll > 0.9) stops = 2
    }

    const itineraries: Itinerary[] = []
    for (const slice of request.slices) {
      const offsetHours = 5 + Math.floor(rand() * 17) // 05:00 .. 22:00
      itineraries.push(buildItinerary(slice, carrier, stops, cabin, offsetHours, rand, i))
    }

    const totalMinutes = itineraries.reduce(
      (acc, itin) => acc + (durationOfItinerary(itin) ?? 0),
      0,
    )
    const baseFarePerAdult = priceFor(carrier, cabin, totalMinutes, rand)
    const fareBreakdowns = buildFareBreakdowns(request.passengers, baseFarePerAdult)
    const totalAmount = fareBreakdowns.reduce(
      (sum, b) => sum + Number(b.total.amount) * b.passengerCount,
      0,
    )

    const offerId = `demo_${seed.toString(36)}_${i}`

    offers.push({
      offerId,
      source: "demo",
      itineraries,
      fareBreakdowns,
      totalPrice: { amount: totalAmount.toFixed(2), currency: "EUR" },
      validatingCarrier: carrier.code,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      lastTicketingDate: addDays(new Date(), 1).toISOString().slice(0, 10),
      instantTicketing: false,
      fareBundles: synthesizeFareBundles(carrier, cabin, totalMinutes),
    })
  }

  // Sort cheapest first — most expected ordering for ecommerce search.
  offers.sort((a, b) => Number(a.totalPrice.amount) - Number(b.totalPrice.amount))
  return offers
}

function buildItinerary(
  slice: FlightSlice,
  carrier: DemoCarrier,
  stops: number,
  cabin: CabinClass,
  startHour: number,
  rand: () => number,
  variant: number,
): Itinerary {
  const segments: FlightSegment[] = []
  const baseDate = slice.departureDate

  // Direct: one segment origin → destination
  // 1 stop : origin → hub → destination
  // 2 stops: origin → hub → hub2 → destination
  const stations: string[] = [slice.origin]
  if (stops >= 1) stations.push(carrier.hubs[0] ?? "AMS")
  if (stops >= 2) stations.push(carrier.hubs[1] ?? carrier.hubs[0] ?? "FRA")
  stations.push(slice.destination)
  // Avoid silly self-routing when origin/destination IS the hub.
  for (let i = 1; i < stations.length - 1; i++) {
    if (stations[i] === stations[0] || stations[i] === stations[stations.length - 1]) {
      stations.splice(i, 1)
      i--
    }
  }

  let cursor = setHourMinute(baseDate, startHour, Math.floor(rand() * 12) * 5)
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i] as string
    const to = stations[i + 1] as string
    const flightMinutes = 60 + Math.floor(rand() * 240) // 1h..5h per leg
    const departureAt = cursor
    const arrivalAt = new Date(departureAt.getTime() + flightMinutes * 60_000)

    segments.push({
      segmentId: `${carrier.code}-${variant}-${i}`,
      carrierCode: carrier.code,
      flightNumber: String(100 + Math.floor(rand() * 8000)),
      departure: { iataCode: from, at: departureAt.toISOString() },
      arrival: { iataCode: to, at: arrivalAt.toISOString() },
      duration: minutesToIso8601(flightMinutes),
      aircraft: AIRCRAFT_TYPES[Math.floor(rand() * AIRCRAFT_TYPES.length)],
      cabin,
    })

    // Layover: 1h..3h
    const layover = 60 + Math.floor(rand() * 120)
    cursor = new Date(arrivalAt.getTime() + layover * 60_000)
  }

  const totalMinutes =
    (new Date(segments[segments.length - 1]!.arrival.at).getTime() -
      new Date(segments[0]!.departure.at).getTime()) /
    60_000

  return { segments, duration: minutesToIso8601(Math.round(totalMinutes)) }
}

function buildFareBreakdowns(
  pax: FlightSearchRequest["passengers"],
  baseFarePerAdult: number,
): FareBreakdown[] {
  const out: FareBreakdown[] = []
  const breakdown = (
    type: "adult" | "child" | "infant",
    count: number,
    multiplier: number,
  ): FareBreakdown => {
    const base = baseFarePerAdult * multiplier
    const tax = base * 0.18
    const total = base + tax
    return {
      passengerType: type,
      passengerCount: count,
      baseFare: { amount: base.toFixed(2), currency: "EUR" },
      taxes: { amount: tax.toFixed(2), currency: "EUR" },
      total: { amount: total.toFixed(2), currency: "EUR" },
    }
  }
  if (pax.adults > 0) out.push(breakdown("adult", pax.adults, 1))
  if (pax.children && pax.children > 0) out.push(breakdown("child", pax.children, 0.75))
  if (pax.infants && pax.infants > 0) out.push(breakdown("infant", pax.infants, 0.1))
  return out
}

function priceFor(
  carrier: DemoCarrier,
  cabin: CabinClass,
  totalMinutes: number,
  rand: () => number,
): number {
  // Roughly: €0.5/minute for short-haul economy, scaled by carrier + cabin
  // + a small jitter so identical itineraries don't all land on the same
  // fare. Floor of €40 (low-cost short-haul).
  const base = Math.max(40, totalMinutes * 0.5)
  const jitter = 0.85 + rand() * 0.3
  return base * carrier.basePriceMultiplier * CABIN_PRICE_MULT[cabin] * jitter
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function durationOfItinerary(itin: Itinerary): number | null {
  const first = itin.segments[0]
  const last = itin.segments[itin.segments.length - 1]
  if (!first || !last) return null
  const ms = new Date(last.arrival.at).getTime() - new Date(first.departure.at).getTime()
  return Number.isFinite(ms) ? Math.round(ms / 60_000) : null
}

function setHourMinute(dateIso: string, hour: number, minute: number): Date {
  // Treat date as local midnight UTC to keep determinism timezone-agnostic.
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCHours(hour, minute, 0, 0)
  return d
}

function minutesToIso8601(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}` || "PT0M"
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + n)
  return copy
}

/**
 * Tiny 32-bit PRNG (Mulberry32). Deterministic from a seed — matches what
 * other demo generators in the codebase use so behavior is comparable.
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function hashRequest(request: Omit<FlightSearchRequest, "pagination">): number {
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

/**
 * Apply server-side filters from `request.searchOptions` to the offer pool
 * BEFORE pagination. Mirrors what a real GDS adapter would do — filters
 * are part of the search query, not a client-side post-process, so the
 * `total` we return matches what a paginated UI navigates through.
 */
export function applySearchFilters(
  offers: FlightOffer[],
  request: FlightSearchRequest,
): FlightOffer[] {
  const opts = request.searchOptions
  if (!opts) return offers

  return offers.filter((offer) => {
    // Carriers — match any (the offer carries it on at least one segment)
    if (opts.includeCarriers && opts.includeCarriers.length > 0) {
      const carriers = new Set<string>()
      for (const it of offer.itineraries) for (const s of it.segments) carriers.add(s.carrierCode)
      if (!opts.includeCarriers.some((c) => carriers.has(c))) return false
    }
    if (opts.excludeCarriers && opts.excludeCarriers.length > 0) {
      const carriers = new Set<string>()
      for (const it of offer.itineraries) for (const s of it.segments) carriers.add(s.carrierCode)
      if (opts.excludeCarriers.some((c) => carriers.has(c))) return false
    }
    // Stops — `directOnly` overrides `maxStops`
    const maxStops = opts.directOnly ? 0 : opts.maxStops
    if (maxStops != null) {
      const offerMax = Math.max(0, ...offer.itineraries.map((i) => i.segments.length - 1))
      if (offerMax > maxStops) return false
    }
    // Price cap — same-currency (demo is all EUR)
    if (opts.maxPrice != null) {
      if (Number(offer.totalPrice.amount) > opts.maxPrice) return false
    }
    return true
  })
}

export function parsePageCursor(cursor: string | undefined): number {
  if (!cursor) return 1
  const n = Number(cursor)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

/**
 * Build a deterministic-ish FlightOrder from a book request. PNR + orderId
 * are derived from the offerId hash so the same offer always produces the
 * same record locator (handy for testing). Status defaults to `confirmed`
 * with a 24h payment deadline; `card`/`ticket_on_credit` intents flip
 * straight to `ticketed` and emit fake ticket numbers. Ancillary selections
 * are summed into the order total and echoed on `providerData.ancillaries`.
 */
export function synthesizeOrder(request: FlightBookRequest): FlightOrder {
  const offer = request.offer!
  // Seed with the offer + the wall clock + a random nonce so every
  // `bookFlight` call produces a fresh PNR and orderId — real GDS systems
  // never reuse PNRs even for identical itineraries. Determinism is only
  // useful for offers/seatmaps (stable deep-links during dev), not orders.
  const seed = hashString(`${offer.offerId}|${Date.now()}|${Math.random()}`)
  const rand = mulberry32(seed)
  const pnr = randomPnr(rand)
  const orderId = `demo_ord_${pnr.toLowerCase()}`
  const intent = request.paymentIntent ?? { type: "hold" }
  const ticketed = intent.type !== "hold"

  const tickets: FlightTicket[] | undefined = ticketed
    ? request.passengers.map((p) => ({
        ticketNumber: `${offer.validatingCarrier ?? "XX"}${String(100_000_000 + Math.floor(rand() * 900_000_000))}`,
        passengerId: p.passengerId,
        segmentIds: offer.itineraries.flatMap((i) => i.segments.map((s) => s.segmentId)),
        status: "OK",
      }))
    : undefined

  const now = new Date()
  const paymentDeadline = ticketed
    ? undefined
    : new Date(now.getTime() + 24 * 60 * 60_000).toISOString()

  // Sum ancillary picks into the order total; the per-leg catalog the UI
  // fetched is what the prices reflect, but at this seam we re-synthesize
  // the catalog from each itinerary to look the prices up — keeps the
  // server authoritative on amounts (the UI's price could be stale).
  const ancillaryTotal = computeAncillaryTotal(offer, request.ancillaries)
  const orderTotal: FlightOrder["totalPrice"] = {
    amount: (Number(offer.totalPrice.amount) + ancillaryTotal).toFixed(2),
    currency: offer.totalPrice.currency,
  }

  const providerData: Record<string, unknown> = { ...(offer.providerData ?? {}) }
  if (request.ancillaries) providerData.ancillaries = request.ancillaries

  return {
    orderId,
    pnr,
    status: ticketed ? "ticketed" : "confirmed",
    offer,
    passengers: request.passengers,
    contact: request.contact,
    tickets,
    totalPrice: orderTotal,
    paymentDeadline,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    providerData,
  }
}

/**
 * Compute the additional charge from ancillary picks against an offer. Looks
 * the prices up in the synthesized catalog (deterministic) so the server is
 * authoritative on totals — UI prices can be stale or tampered with.
 */
function computeAncillaryTotal(
  offer: FlightOffer,
  selection: AncillarySelection | undefined,
): number {
  if (!selection) return 0
  let total = 0

  // Branded-fare bundle picks — `priceDelta` is per-pax; each pick sums in
  // once. Per-pax per-slice picks naturally cover the "everyone same fare"
  // case (N picks of the same bundle id on a leg = N × delta).
  if (selection.fareBundle && offer.fareBundles && offer.fareBundles.length > 0) {
    for (const pick of selection.fareBundle) {
      const bundle = offer.fareBundles.find((b) => b.id === pick.bundleId)
      if (bundle) total += Number(bundle.priceDelta.amount)
    }
  }

  for (let sliceIndex = 0; sliceIndex < offer.itineraries.length; sliceIndex++) {
    const itin = offer.itineraries[sliceIndex]
    if (!itin) continue
    const catalog = catalogForItinerary(itin)
    for (const pick of selection.baggage ?? []) {
      if (pick.sliceIndex !== sliceIndex) continue
      const opt = catalog.baggage.find((o) => o.id === pick.optionId)
      if (opt) total += Number(opt.price.amount) * (pick.quantity ?? 1)
    }
    for (const pick of selection.extras ?? []) {
      if (pick.sliceIndex !== sliceIndex) continue
      const opt = catalog.extras.find((o) => o.id === pick.optionId)
      if (!opt) continue
      const qty = pick.quantity ?? 1
      total += Number(opt.price.amount) * qty
    }
  }
  // Seats — look up the per-segment map and price each pick. Seats can
  // span multiple itineraries; iterate over every segment in the offer.
  for (const itin of offer.itineraries) {
    for (const segment of itin.segments) {
      const seatMap = synthesizeSeatMap(segment)
      for (const pick of selection.seats ?? []) {
        if (pick.segmentId !== segment.segmentId) continue
        const seat = findSeatInMap(seatMap, pick.seatNumber)
        if (seat?.price) total += Number(seat.price.amount)
      }
    }
  }
  // Assistance is free in the demo (Wizz-style); skip.
  return total
}

// ─────────────────────────────────────────────────────────────────────────────
// Ancillary catalog synthesis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a deterministic ancillary catalog for an offer. Catalog covers ALL
 * itineraries on the offer (one-leg-per-offer in the per-leg flow, two when
 * the offer is a combined round-trip). For consistency with the UI's
 * per-leg catalog model, callers fetching a single-leg offer get a single
 * itinerary's worth of options.
 *
 * Per-leg pricing is a function of: route distance (proxy = total minutes),
 * carrier (low-cost vs full-service), and cabin (premium tiers absorb
 * baggage).
 */
export function synthesizeAncillaryCatalog(offer: FlightOffer): AncillaryCatalog {
  const itin = offer.itineraries[0]
  if (!itin) {
    return { baggage: [], assistance: [], extras: [] }
  }
  return catalogForItinerary(itin)
}

function catalogForItinerary(itin: Itinerary): AncillaryCatalog {
  const minutes = durationOfItinerary(itin) ?? 120
  const seg = itin.segments[0]
  const cabin = (seg?.cabin ?? "economy") as CabinClass
  const carrier = seg?.carrierCode ?? ""

  // Low-cost short-haul charges more aggressively for bags; full-service
  // long-haul includes more.
  const lowCost = carrier === "U2" || carrier === "FR"
  const longHaul = minutes > 360
  const cabinFreeBags = cabin === "business" || cabin === "first"

  const bagBase = lowCost ? 18 : longHaul ? 30 : 22
  const bagPriceFor = (kg: number) => {
    const factor = kg <= 10 ? 1 : kg <= 20 ? 1.7 : kg <= 26 ? 2.3 : 3.1
    return Math.round(bagBase * factor)
  }

  const baggage: AncillaryBaggageOption[] = cabinFreeBags
    ? [
        {
          id: "bag_included",
          label: "32 kg checked bag (included)",
          category: "checked",
          weightKg: 32,
          price: { amount: "0.00", currency: "EUR" },
          recommended: true,
        },
        {
          id: "bag_extra_32",
          label: "Additional 32 kg checked bag",
          category: "checked",
          weightKg: 32,
          price: { amount: bagPriceFor(32).toFixed(2), currency: "EUR" },
        },
      ]
    : [
        {
          id: "bag_10",
          label: "10 kg checked bag",
          category: "checked",
          weightKg: 10,
          price: { amount: bagPriceFor(10).toFixed(2), currency: "EUR" },
        },
        {
          id: "bag_20",
          label: "20 kg checked bag",
          category: "checked",
          weightKg: 20,
          price: { amount: bagPriceFor(20).toFixed(2), currency: "EUR" },
          recommended: true,
        },
        {
          id: "bag_26",
          label: "26 kg checked bag",
          category: "checked",
          weightKg: 26,
          price: { amount: bagPriceFor(26).toFixed(2), currency: "EUR" },
        },
        {
          id: "bag_32",
          label: "32 kg checked bag",
          category: "checked",
          weightKg: 32,
          price: { amount: bagPriceFor(32).toFixed(2), currency: "EUR" },
        },
      ]

  const assistance: AncillaryAssistanceOption[] = [
    { id: "asst_wchr", label: "Wheelchair to gate", category: "wheelchair" },
    { id: "asst_wchs", label: "Wheelchair – steps", category: "wheelchair" },
    { id: "asst_blnd", label: "Visual impairment assistance", category: "visual" },
    { id: "asst_deaf", label: "Hearing impairment assistance", category: "hearing" },
    { id: "asst_med", label: "Medical case (with documentation)", category: "medical" },
  ]

  const extras: AncillaryExtraOption[] = [
    {
      id: "ext_priority",
      label: "Priority boarding",
      category: "boarding",
      price: { amount: lowCost ? "8.00" : "15.00", currency: "EUR" },
    },
    {
      id: "ext_sports",
      label: "Sports equipment (≤ 32 kg)",
      category: "baggage",
      price: { amount: bagPriceFor(32).toFixed(2), currency: "EUR" },
    },
    {
      id: "ext_pet",
      label: "Pet in cabin (≤ 8 kg)",
      category: "pet",
      price: { amount: lowCost ? "55.00" : "75.00", currency: "EUR" },
    },
  ]

  return { baggage, assistance, extras }
}

function randomPnr(rand: () => number): string {
  // 6-char alphanumeric uppercase, classic GDS shape.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(rand() * alphabet.length)]
  }
  return out
}

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Seat map synthesis
// ─────────────────────────────────────────────────────────────────────────────

interface AircraftLayout {
  /** Cabin column letters in order; null = aisle gap. */
  columns: Array<string | null>
  /** Total rows in economy. */
  rows: number
  /** 1-indexed row numbers that have extra legroom (exit rows). */
  exitRows: number[]
  /** 1-indexed row numbers that count as XL / preferred (front of cabin). */
  preferredRows: number[]
  /** Display name for tooltips. */
  displayName?: string
}

/**
 * Hand-tuned layouts for the aircraft codes the demo uses. Keeps the synthesis
 * deterministic and visually distinct between narrow- and wide-body kit.
 * Anything not in the table falls through to a sensible 3-3 narrow-body
 * default.
 */
const AIRCRAFT_LAYOUTS: Record<string, AircraftLayout> = {
  "738": {
    columns: ["A", "B", "C", null, "D", "E", "F"],
    rows: 30,
    exitRows: [12, 13],
    preferredRows: [1, 2, 3, 4],
    displayName: "Boeing 737-800",
  },
  "32A": {
    columns: ["A", "B", "C", null, "D", "E", "F"],
    rows: 31,
    exitRows: [11, 12],
    preferredRows: [1, 2, 3, 4],
    displayName: "Airbus A320",
  },
  "320": {
    columns: ["A", "B", "C", null, "D", "E", "F"],
    rows: 31,
    exitRows: [11, 12],
    preferredRows: [1, 2, 3, 4],
    displayName: "Airbus A320",
  },
  "321": {
    columns: ["A", "B", "C", null, "D", "E", "F"],
    rows: 35,
    exitRows: [12, 13],
    preferredRows: [1, 2, 3, 4],
    displayName: "Airbus A321",
  },
  "77W": {
    columns: ["A", "B", "C", null, "D", "E", "F", "G", null, "H", "J", "K"],
    rows: 38,
    exitRows: [20, 21, 30],
    preferredRows: [1, 2, 3, 4, 5],
    displayName: "Boeing 777-300ER",
  },
  "788": {
    columns: ["A", "B", "C", null, "D", "E", "F", null, "G", "H", "J"],
    rows: 32,
    exitRows: [18, 19],
    preferredRows: [1, 2, 3, 4],
    displayName: "Boeing 787-8",
  },
  "789": {
    columns: ["A", "B", "C", null, "D", "E", "F", null, "G", "H", "J"],
    rows: 36,
    exitRows: [20, 21, 28],
    preferredRows: [1, 2, 3, 4],
    displayName: "Boeing 787-9",
  },
  "359": {
    columns: ["A", "B", "C", null, "D", "E", "F", null, "G", "H", "J"],
    rows: 36,
    exitRows: [20, 21, 28],
    preferredRows: [1, 2, 3, 4],
    displayName: "Airbus A350-900",
  },
  "351": {
    columns: ["A", "B", "C", null, "D", "E", "F", null, "G", "H", "J"],
    rows: 40,
    exitRows: [21, 22, 32],
    preferredRows: [1, 2, 3, 4, 5],
    displayName: "Airbus A350-1000",
  },
  "388": {
    columns: ["A", "B", "C", null, "D", "E", "F", "G", null, "H", "J", "K"],
    rows: 44,
    exitRows: [22, 23, 36],
    preferredRows: [1, 2, 3, 4, 5, 6],
    displayName: "Airbus A380",
  },
}

const DEFAULT_LAYOUT: AircraftLayout = {
  columns: ["A", "B", "C", null, "D", "E", "F"],
  rows: 30,
  exitRows: [12, 13],
  preferredRows: [1, 2, 3, 4],
}

/**
 * Build a deterministic seat map for a single segment. Layout chosen by
 * aircraft code; status (available / blocked / unavailable) seeded from the
 * segment id so the same flight always shows the same seat availability
 * across reloads. Pricing varies by category + cabin class.
 */
export function synthesizeSeatMap(segment: FlightSegment): SeatMap {
  const layout = AIRCRAFT_LAYOUTS[segment.aircraft ?? ""] ?? DEFAULT_LAYOUT
  const rand = mulberry32(hashString(segment.segmentId))
  const cabin = segment.cabin

  const exitRowSet = new Set(layout.exitRows)
  const preferredRowSet = new Set(layout.preferredRows)

  const rows: SeatRow[] = []
  for (let r = 1; r <= layout.rows; r++) {
    const seats: Seat[] = []
    layout.columns.forEach((col, idx) => {
      if (col == null) return
      const isWindow = idx === 0 || idx === layout.columns.length - 1
      const isAisle = layout.columns[idx - 1] === null || layout.columns[idx + 1] === null

      let category: Seat["category"] = "standard"
      if (exitRowSet.has(r)) category = "exit_row"
      else if (preferredRowSet.has(r)) category = "preferred"

      // ~12% of seats are blocked (already taken); 1% unavailable (galley).
      const roll = rand()
      let status: Seat["status"] = "available"
      if (roll < 0.01) status = "unavailable"
      else if (roll < 0.13) status = "blocked"

      const price = priceForSeat(category, cabin, isWindow, isAisle)
      const seat: Seat = {
        seatNumber: `${r}${col}`,
        row: r,
        column: col,
        status,
        category,
        ...(isWindow ? { window: true } : {}),
        ...(isAisle ? { aisle: true } : {}),
        ...(price ? { price } : {}),
        ...(category === "exit_row"
          ? { notes: "Adult only · no infants · brace position required" }
          : {}),
      }
      seats.push(seat)
    })
    rows.push({ row: r, seats })
  }

  return {
    segmentId: segment.segmentId,
    aircraft: segment.aircraft,
    cabin,
    columnLayout: layout.columns,
    rows,
    providerData: layout.displayName ? { aircraftName: layout.displayName } : undefined,
  }
}

/** Per-seat fee schedule. Premium cabins absorb seat fees; economy doesn't. */
function priceForSeat(
  category: Seat["category"],
  cabin: CabinClass,
  isWindow: boolean,
  isAisle: boolean,
): { amount: string; currency: string } | undefined {
  if (cabin === "business" || cabin === "first") return undefined
  let cents = 0
  if (category === "exit_row") cents = 1500
  else if (category === "preferred") cents = 1000
  else if (isWindow || isAisle) cents = 400
  else cents = 0
  if (cents === 0) return undefined
  return { amount: (cents / 100).toFixed(2), currency: "EUR" }
}

export function findSegmentInOffer(offer: FlightOffer, segmentId: string): FlightSegment | null {
  for (const itin of offer.itineraries) {
    for (const seg of itin.segments) {
      if (seg.segmentId === segmentId) return seg
    }
  }
  return null
}

function findSeatInMap(map: SeatMap, seatNumber: string): Seat | null {
  for (const row of map.rows) {
    for (const seat of row.seats) {
      if (seat.seatNumber === seatNumber) return seat
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Branded-fare bundles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synthesize the 3-tier branded fare ladder for an offer (Basic / Standard /
 * Plus). Inclusions and price deltas vary with carrier (low-cost stays lean
 * with bigger upsells; full-service includes more on Standard) and journey
 * length (long-haul Plus adds lounge access, scales the delta up).
 */
function synthesizeFareBundles(
  carrier: DemoCarrier,
  cabin: CabinClass,
  totalMinutes: number,
): FareBundle[] {
  const lowCost = carrier.code === "U2" || carrier.code === "FR"
  const longHaul = totalMinutes > 360
  const cabinIncludesAll = cabin === "business" || cabin === "first"

  const standardDelta = lowCost ? 18 : longHaul ? 45 : 25
  const plusDelta = lowCost ? 42 : longHaul ? 110 : 60

  const basic: FareBundle = {
    id: "fare_basic",
    label: cabinIncludesAll ? `${labelForCarrier(carrier)} Light` : "Basic",
    tier: "basic",
    priceDelta: { amount: "0.00", currency: "EUR" },
    inclusions: {
      cabinBag: { included: true, weightKg: 10 },
      checkedBag: cabinIncludesAll
        ? { included: true, pieces: 1, weightKg: 32 }
        : { included: false },
      seatSelection: "none",
      priorityBoarding: false,
      loungeAccess: false,
      refundable: false,
      changeable: false,
    },
  }

  const standard: FareBundle = {
    id: "fare_standard",
    label: cabinIncludesAll ? `${labelForCarrier(carrier)} Classic` : "Standard",
    tier: "standard",
    priceDelta: { amount: standardDelta.toFixed(2), currency: "EUR" },
    recommended: true,
    inclusions: {
      cabinBag: { included: true, weightKg: 10 },
      checkedBag: { included: true, pieces: 1, weightKg: 23 },
      seatSelection: "standard",
      priorityBoarding: !lowCost,
      loungeAccess: false,
      refundable: false,
      changeable: true,
    },
  }

  const plus: FareBundle = {
    id: "fare_plus",
    label: cabinIncludesAll ? `${labelForCarrier(carrier)} Plus` : "Plus",
    tier: "plus",
    priceDelta: { amount: plusDelta.toFixed(2), currency: "EUR" },
    inclusions: {
      cabinBag: { included: true, weightKg: 10 },
      checkedBag: { included: true, pieces: 1, weightKg: 32 },
      seatSelection: "free",
      priorityBoarding: true,
      loungeAccess: longHaul || cabinIncludesAll,
      refundable: true,
      changeable: true,
      notes: longHaul ? ["Free meal on board"] : undefined,
    },
  }

  return [basic, standard, plus]
}

function labelForCarrier(carrier: DemoCarrier): string {
  // Friendly carrier-prefixed names. Falls back to the IATA code.
  const names: Record<string, string> = {
    BA: "British Airways",
    AF: "Air France",
    KL: "KLM",
    LH: "Lufthansa",
    AA: "American",
    DL: "Delta",
    UA: "United",
    EK: "Emirates",
    QR: "Qatar",
    SQ: "Singapore",
    AY: "Finnair",
    U2: "easyJet",
    FR: "Ryanair",
  }
  return names[carrier.code] ?? carrier.code
}
