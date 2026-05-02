"use client"

import type { CabinClass, FlightSearchRequest } from "@voyantjs/flights/contract/types"
import { Badge } from "@voyantjs/ui/components/badge"
import { cn } from "@voyantjs/ui/lib/utils"
import { ArrowRight, Sparkles } from "lucide-react"

export interface PopularRoute {
  /** Origin IATA code. */
  origin: string
  /** Display label for the origin (e.g. city). */
  originLabel: string
  /** Destination IATA code. */
  destination: string
  destinationLabel: string
  /** Optional human-readable hint shown beneath the route ("From €120"). */
  hint?: string
  /** Trip flavor tag — purely cosmetic. */
  tag?: string
}

export interface PopularRoutesProps {
  routes: PopularRoute[]
  /** Called when the user clicks a card. The page builds a search from this. */
  onSelect: (request: FlightSearchRequest) => void
  /** Trip type used for the synthesized request. Default `"round_trip"`. */
  tripType?: "one_way" | "round_trip"
  /** Days from today to use as departure date. Default 14. */
  daysOut?: number
  /** Trip duration when round-trip. Default 7. */
  tripNights?: number
  /** Cabin class for the synthesized request. Default `"economy"`. */
  cabin?: CabinClass
  /** Adults for the synthesized request. Default 1. */
  adults?: number
  className?: string
  /** Section title; pass `null` to hide. */
  title?: string | null
}

/**
 * Default route set — recognizable city pairs across regions so a fresh
 * /flights page has something to click without having to type airports.
 * Pages can pass their own `routes` to override.
 */
export const DEFAULT_POPULAR_ROUTES: PopularRoute[] = [
  {
    origin: "LHR",
    originLabel: "London",
    destination: "JFK",
    destinationLabel: "New York",
    tag: "Transatlantic",
    hint: "Premium cabins, daily",
  },
  {
    origin: "CDG",
    originLabel: "Paris",
    destination: "DXB",
    destinationLabel: "Dubai",
    tag: "Connecting hub",
    hint: "Wide carrier mix",
  },
  {
    origin: "AMS",
    originLabel: "Amsterdam",
    destination: "SIN",
    destinationLabel: "Singapore",
    tag: "Long-haul",
    hint: "Nonstop options",
  },
  {
    origin: "FRA",
    originLabel: "Frankfurt",
    destination: "NRT",
    destinationLabel: "Tokyo",
    tag: "Long-haul",
    hint: "12-13h nonstop",
  },
  {
    origin: "MAD",
    originLabel: "Madrid",
    destination: "GRU",
    destinationLabel: "São Paulo",
    tag: "Latin America",
    hint: "10h nonstop",
  },
  {
    origin: "BCN",
    originLabel: "Barcelona",
    destination: "FCO",
    destinationLabel: "Rome",
    tag: "Short-haul",
    hint: "From €60",
  },
  {
    origin: "LGW",
    originLabel: "London Gatwick",
    destination: "MAD",
    destinationLabel: "Madrid",
    tag: "Short-haul",
    hint: "LCC dominant",
  },
  {
    origin: "DXB",
    originLabel: "Dubai",
    destination: "BKK",
    destinationLabel: "Bangkok",
    tag: "Asia",
    hint: "6h nonstop",
  },
  {
    origin: "SFO",
    originLabel: "San Francisco",
    destination: "HND",
    destinationLabel: "Tokyo",
    tag: "Trans-Pacific",
    hint: "11h nonstop",
  },
  {
    origin: "ZRH",
    originLabel: "Zurich",
    destination: "JNB",
    destinationLabel: "Johannesburg",
    tag: "Africa",
    hint: "11h overnight",
  },
]

/**
 * A grid of clickable popular-route cards. Each card synthesizes a
 * `FlightSearchRequest` (round-trip by default, 14 days out, 7 nights) and
 * fires `onSelect` so the page can prefill its form + run the search in one
 * step. Designed for the empty-state of a flights page: gives the user
 * something to do without typing airport codes.
 */
export function PopularRoutes({
  routes,
  onSelect,
  tripType = "round_trip",
  daysOut = 14,
  tripNights = 7,
  cabin = "economy",
  adults = 1,
  className,
  title = "Popular routes",
}: PopularRoutesProps) {
  const today = new Date()
  const departure = isoDate(addDays(today, daysOut))
  const returnDate = isoDate(addDays(today, daysOut + tripNights))

  const buildRequest = (route: PopularRoute): FlightSearchRequest => {
    const slices = [
      { origin: route.origin, destination: route.destination, departureDate: departure },
    ]
    if (tripType === "round_trip") {
      slices.push({
        origin: route.destination,
        destination: route.origin,
        departureDate: returnDate,
      })
    }
    return { slices, passengers: { adults, children: 0, infants: 0 }, cabin }
  }

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {title && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Sparkles className="h-4 w-4" />
          <span>{title}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {routes.map((route) => (
          <button
            key={`${route.origin}-${route.destination}`}
            type="button"
            onClick={() => onSelect(buildRequest(route))}
            className="group flex flex-col gap-2 rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="flex flex-col leading-tight">
                <span className="font-mono text-xs text-muted-foreground">{route.origin}</span>
                <span className="font-medium">{route.originLabel}</span>
              </span>
              <ArrowRight className="mx-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              <span className="flex flex-col text-right leading-tight">
                <span className="font-mono text-xs text-muted-foreground">{route.destination}</span>
                <span className="font-medium">{route.destinationLabel}</span>
              </span>
            </div>
            <div className="mt-auto flex items-center justify-between">
              {route.tag && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {route.tag}
                </Badge>
              )}
              {route.hint && <span className="text-xs text-muted-foreground">{route.hint}</span>}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + n)
  return copy
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
