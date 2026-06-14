"use client"

import type { CabinClass, FlightSearchRequest } from "@voyant-travel/flights/contract/types"
import { Badge } from "@voyant-travel/ui/components/badge"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ArrowRight, Sparkles } from "lucide-react"
import { flightsUiEn } from "../i18n/en.js"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"

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
const DEFAULT_POPULAR_ROUTE_CODES: Array<Pick<PopularRoute, "origin" | "destination">> = [
  {
    origin: "LHR",
    destination: "JFK",
  },
  {
    origin: "CDG",
    destination: "DXB",
  },
  {
    origin: "AMS",
    destination: "SIN",
  },
  {
    origin: "FRA",
    destination: "NRT",
  },
  {
    origin: "MAD",
    destination: "GRU",
  },
  {
    origin: "BCN",
    destination: "FCO",
  },
  {
    origin: "LGW",
    destination: "MAD",
  },
  {
    origin: "DXB",
    destination: "BKK",
  },
  {
    origin: "SFO",
    destination: "HND",
  },
  {
    origin: "ZRH",
    destination: "JNB",
  },
]

export const DEFAULT_POPULAR_ROUTES: PopularRoute[] = DEFAULT_POPULAR_ROUTE_CODES.map(
  (route, index) => ({
    ...route,
    ...defaultRouteMessages(flightsUiEn.popularRoutes.defaults, index),
  }),
)

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
  title,
}: PopularRoutesProps) {
  const messages = useFlightsUiMessagesOrDefault().popularRoutes
  const resolvedRoutes = routes.map((route, index) =>
    route === DEFAULT_POPULAR_ROUTES[index]
      ? {
          ...route,
          ...defaultRouteMessages(messages.defaults, index),
        }
      : route,
  )
  const resolvedTitle = title === undefined ? messages.title : title
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
      {resolvedTitle && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Sparkles className="h-4 w-4" />
          <span>{resolvedTitle}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {resolvedRoutes.map((route) => (
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

function defaultRouteMessages(
  defaults: Array<Pick<PopularRoute, "originLabel" | "destinationLabel" | "tag" | "hint">>,
  index: number,
): Pick<PopularRoute, "originLabel" | "destinationLabel" | "tag" | "hint"> {
  return (
    defaults[index] ?? {
      originLabel: "",
      destinationLabel: "",
      tag: "",
      hint: "",
    }
  )
}
