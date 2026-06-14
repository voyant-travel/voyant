import type { CabinClass, FareBundle } from "@voyant-travel/flights/contract/types"

import type { DemoCarrier } from "./synthesis-common.js"

/**
 * Synthesize the 3-tier branded fare ladder for an offer (Basic / Standard /
 * Plus). Inclusions and price deltas vary with carrier (low-cost stays lean
 * with bigger upsells; full-service includes more on Standard) and journey
 * length (long-haul Plus adds lounge access, scales the delta up).
 */
export function synthesizeFareBundles(
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
