import type {
  AncillaryCatalog,
  AncillarySelection,
  FlightOffer,
  SeatMap,
} from "@voyantjs/flights/contract/types"
import { formatMessage } from "@voyantjs/i18n"
import type { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import type { FlightItinerarySelection, LedgerLineItem } from "./flight-booking-ledger.js"
import {
  ALL_STEPS,
  ALWAYS_VISIBLE,
  type FlightBookingAncillaries,
  type FlightBookingSeatMaps,
  type StepDef,
} from "./flight-booking-shell-types.js"

type FlightsUiMessages = ReturnType<typeof useFlightsUiMessagesOrDefault>

export function getVisibleFlightBookingSteps({
  selection,
  ancillaries,
  seatMaps,
}: {
  selection: FlightItinerarySelection
  ancillaries?: FlightBookingAncillaries
  seatMaps?: FlightBookingSeatMaps
}): ReadonlyArray<StepDef> {
  const hasFareBundles =
    (selection.outbound.fareBundles?.length ?? 0) > 0 ||
    (selection.return?.fareBundles?.length ?? 0) > 0
  const cat = ancillaries?.outboundCatalog
  const catReturn = ancillaries?.returnCatalog
  const ancillariesLoading = !!ancillaries?.loading
  const hasBags =
    ancillariesLoading || (cat?.baggage.length ?? 0) > 0 || (catReturn?.baggage.length ?? 0) > 0
  const hasServices =
    ancillariesLoading ||
    (cat?.assistance.length ?? 0) > 0 ||
    (cat?.extras.length ?? 0) > 0 ||
    (catReturn?.assistance.length ?? 0) > 0 ||
    (catReturn?.extras.length ?? 0) > 0
  const hasSeats = !!seatMaps

  return ALL_STEPS.filter((s) => {
    if (ALWAYS_VISIBLE.has(s.id)) return true
    if (s.id === "fares") return hasFareBundles
    if (s.id === "bags") return hasBags
    if (s.id === "seats") return hasSeats
    if (s.id === "services") return hasServices
    return true
  })
}

export function buildLedgerExtras({
  baggage,
  extras,
  assistance,
  seats,
  fareBundles,
  outboundOffer,
  returnOffer,
  outboundCatalog,
  returnCatalog,
  seatMaps,
  messages,
}: {
  baggage: NonNullable<AncillarySelection["baggage"]>
  extras: NonNullable<AncillarySelection["extras"]>
  assistance: NonNullable<AncillarySelection["assistance"]>
  seats: NonNullable<AncillarySelection["seats"]>
  fareBundles: NonNullable<AncillarySelection["fareBundle"]>
  outboundOffer: FlightOffer
  returnOffer?: FlightOffer
  outboundCatalog: AncillaryCatalog | null
  returnCatalog: AncillaryCatalog | null
  seatMaps?: FlightBookingSeatMaps
  messages: FlightsUiMessages
}): { outboundExtras: LedgerLineItem[]; returnExtras: LedgerLineItem[] } {
  const lines = (
    sliceIndex: number,
    catalog: AncillaryCatalog | null,
    offer: FlightOffer | undefined,
  ): LedgerLineItem[] => {
    const out: LedgerLineItem[] = []

    if (offer?.fareBundles) {
      const legPicks = fareBundles.filter((p) => p.sliceIndex === sliceIndex)
      const agg = new Map<
        string,
        { count: number; label: string; price: number; currency: string }
      >()
      for (const p of legPicks) {
        const bundle = offer.fareBundles.find((b) => b.id === p.bundleId)
        if (!bundle) continue
        const prev = agg.get(bundle.id)
        if (prev) {
          prev.count += 1
          prev.price += Number(bundle.priceDelta.amount)
        } else {
          agg.set(bundle.id, {
            count: 1,
            label: bundle.label,
            price: Number(bundle.priceDelta.amount),
            currency: bundle.priceDelta.currency,
          })
        }
      }
      for (const [, v] of agg) {
        const labelSuffix = v.count > 1 ? ` (${v.count} ${messages.common.pax})` : ""
        out.push({
          label: formatMessage(messages.flightBookingShell.lineItems.fare, {
            label: v.label,
            suffix: labelSuffix,
          }),
          amount: v.price > 0 ? { amount: v.price.toFixed(2), currency: v.currency } : undefined,
          meta: v.price === 0 ? messages.common.included : undefined,
        })
      }
    }

    if (catalog) {
      const bagPicks = baggage.filter((b) => b.sliceIndex === sliceIndex)
      const bagAgg = new Map<
        string,
        { count: number; label: string; price: number; currency: string }
      >()
      for (const p of bagPicks) {
        const opt = catalog.baggage.find((o) => o.id === p.optionId)
        if (!opt) continue
        const prev = bagAgg.get(opt.id)
        const qty = p.quantity ?? 1
        if (prev) {
          prev.count += qty
          prev.price += Number(opt.price.amount) * qty
        } else {
          bagAgg.set(opt.id, {
            count: qty,
            label: opt.label,
            price: Number(opt.price.amount) * qty,
            currency: opt.price.currency,
          })
        }
      }
      for (const [, v] of bagAgg) {
        out.push({
          label: v.count > 1 ? `${v.count}× ${v.label}` : v.label,
          amount: v.price > 0 ? { amount: v.price.toFixed(2), currency: v.currency } : undefined,
          meta: v.price === 0 ? messages.common.included : undefined,
        })
      }

      const extraPicks = extras.filter((b) => b.sliceIndex === sliceIndex)
      const extAgg = new Map<
        string,
        { count: number; label: string; price: number; currency: string }
      >()
      for (const p of extraPicks) {
        const opt = catalog.extras.find((o) => o.id === p.optionId)
        if (!opt) continue
        const qty = p.quantity ?? 1
        const prev = extAgg.get(opt.id)
        if (prev) {
          prev.count += qty
          prev.price += Number(opt.price.amount) * qty
        } else {
          extAgg.set(opt.id, {
            count: qty,
            label: opt.label,
            price: Number(opt.price.amount) * qty,
            currency: opt.price.currency,
          })
        }
      }
      for (const [, v] of extAgg) {
        out.push({
          label: v.count > 1 ? `${v.count}× ${v.label}` : v.label,
          amount: { amount: v.price.toFixed(2), currency: v.currency },
        })
      }
    }

    if (offer && seatMaps) {
      const segIds = new Set<string>()
      for (const itin of offer.itineraries) {
        for (const seg of itin.segments) segIds.add(seg.segmentId)
      }
      const seatPicks = seats.filter((p) => segIds.has(p.segmentId))
      if (seatPicks.length > 0) {
        let total = 0
        let currency = "EUR"
        for (const pick of seatPicks) {
          const slot = seatMaps.getSeatMap({ offerId: offer.offerId, segmentId: pick.segmentId })
          const seat = slot.seatMap ? findSeatInMap(slot.seatMap, pick.seatNumber) : null
          if (seat?.price) {
            total += Number(seat.price.amount)
            currency = seat.price.currency
          }
        }
        out.push({
          label: formatMessage(messages.flightBookingShell.lineItems.seatsPicked, {
            count: seatPicks.length,
            plural: seatPicks.length > 1 ? "s" : "",
          }),
          amount: total > 0 ? { amount: total.toFixed(2), currency } : undefined,
          meta: total === 0 ? messages.common.free : undefined,
        })
      }
    }

    if (sliceIndex === 0 && assistance.length > 0) {
      out.push({
        label: formatMessage(messages.flightBookingShell.lineItems.specialAssistance, {
          count: assistance.length,
        }),
        meta: messages.common.free,
      })
    }
    return out
  }
  return {
    outboundExtras: lines(0, outboundCatalog, outboundOffer),
    returnExtras: lines(1, returnCatalog ?? outboundCatalog, returnOffer),
  }
}

export function mergeOffers(selection: FlightItinerarySelection): FlightOffer {
  const { outbound, return: ret } = selection
  if (!ret) return outbound
  const currency = outbound.totalPrice.currency
  const amount = (Number(outbound.totalPrice.amount) + Number(ret.totalPrice.amount)).toFixed(2)
  return {
    offerId: `${outbound.offerId}+${ret.offerId}`,
    source: outbound.source,
    itineraries: [...outbound.itineraries, ...ret.itineraries],
    fareBreakdowns: [...outbound.fareBreakdowns, ...ret.fareBreakdowns],
    totalPrice: { amount, currency },
    validatingCarrier: outbound.validatingCarrier,
    expiresAt: pickEarliest(outbound.expiresAt, ret.expiresAt),
    lastTicketingDate: pickEarliest(outbound.lastTicketingDate, ret.lastTicketingDate),
    instantTicketing: (outbound.instantTicketing ?? false) && (ret.instantTicketing ?? false),
    providerData: {
      ...(outbound.providerData ?? {}),
      ...(ret.providerData ?? {}),
      __mergedFrom: { outbound: outbound.offerId, return: ret.offerId },
    },
  }
}

function findSeatInMap(map: SeatMap, seatNumber: string) {
  for (const row of map.rows) {
    for (const seat of row.seats) {
      if (seat.seatNumber === seatNumber) return seat
    }
  }
  return null
}

function pickEarliest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b
}
