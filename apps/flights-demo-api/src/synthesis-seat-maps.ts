import type {
  CabinClass,
  FlightOffer,
  FlightSegment,
  Seat,
  SeatMap,
  SeatRow,
} from "@voyantjs/flights/contract/types"

import { hashString, mulberry32 } from "./synthesis-common.js"

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

export function findSeatInMap(map: SeatMap, seatNumber: string): Seat | null {
  for (const row of map.rows) {
    for (const seat of row.seats) {
      if (seat.seatNumber === seatNumber) return seat
    }
  }
  return null
}
