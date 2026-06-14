import type {
  AncillaryAssistanceOption,
  AncillaryBaggageOption,
  AncillaryCatalog,
  AncillaryExtraOption,
  CabinClass,
  FlightOffer,
  Itinerary,
} from "@voyant-travel/flights/contract/types"

import { durationOfItinerary } from "./synthesis-common.js"

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

export function catalogForItinerary(itin: Itinerary): AncillaryCatalog {
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
