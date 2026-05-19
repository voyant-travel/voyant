/**
 * Project a `ProductContent` payload into a `BookingDraftShape` so
 * the journey wizard can render the correct sub-steps for a sourced
 * product.
 *
 * Tour-style products typically need:
 *   - Configure: occupancy band selection (adult / child / infant)
 *     and optionally a date / departure picker if `days[]` carries
 *     scheduled departures.
 *   - Travelers: per-pax fields (first / last / email; passport when
 *     the supplier requires it — surfaced via overlay when known).
 *   - Add-ons: the product's own `options[]` projected as add-on
 *     offers.
 *
 * No accommodation sub-step today (multi-day tours w/ rooms route
 * through accommodations, not products). Pricing flows through
 * liveResolve at quote time, not the descriptor.
 *
 * See `docs/architecture/booking-journey-architecture.md` §3 + §F.
 */

import {
  type AddonOffer,
  type BookingDraftShape,
  DEFAULT_PAX_BANDS,
  defaultBookingFields,
  defaultDraftShapeFlags,
  defaultTravelerFields,
  type PaxBandSpec,
  paxBandsAllowedTotalFrom,
} from "@voyantjs/catalog/booking-engine"

import type { ProductContent } from "./content-shape.js"

export interface BuildProductDraftShapeOptions {
  /** Locale — used for option-label fallback. Defaults to `"en-GB"`. */
  locale?: string
  /**
   * Override the default pax bands. Use when the supplier mandates
   * specific age cutoffs (rare for tour products; common for cruises
   * and family-oriented packages).
   */
  paxBands?: ReadonlyArray<PaxBandSpec>
  /**
   * Override the maximum total pax. Defaults to `paxBands` sum.
   * Useful when supplier capacity is < combined band max (e.g. a
   * 6-pax max party on a private tour).
   */
  paxBandsAllowedTotal?: { min: number; max: number }
}

export function buildProductDraftShape(
  content: ProductContent,
  options: BuildProductDraftShapeOptions = {},
): BookingDraftShape {
  const paxBands = options.paxBands ?? DEFAULT_PAX_BANDS
  const total = options.paxBandsAllowedTotal ?? paxBandsAllowedTotalFrom(paxBands)

  // Project the product's own options into add-on offers. Each
  // option becomes an extras-type add-on; verticals with grouped
  // catalogs (cruise excursions) override.
  const addonItems: AddonOffer[] = content.options.map((opt) => ({
    id: opt.id,
    name: opt.name,
    description: opt.description ?? null,
    kind: "extras",
    pricingMode: null,
  }))

  return {
    ...defaultDraftShapeFlags(),
    showsAddons: addonItems.length > 0,
    paxBands,
    paxBandsAllowedTotal: total,
    travelerFields: defaultTravelerFields(),
    bookingFields: defaultBookingFields(),
    addons: addonItems.length > 0 ? { catalog: addonItems } : undefined,
    paymentIntents: ["hold", "card"],
    configureSubSteps: [{ kind: "occupancy", bands: paxBands }],
  }
}
