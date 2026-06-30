import type { AuthoringIssue } from "./errors.js"
import type { ProductGraphSpec } from "./spec.js"

/**
 * Category-aware shape validation. Runs before the builder (compose path) so a
 * wrong-shape spec is rejected with descriptive, agent-recoverable issues
 * instead of producing a malformed-but-bookable product.
 *
 * Keyed on `bookingMode` (the structural classifier in the schema). `supplyModel`
 * is a read-time projection derived from `bookingMode` (see
 * `deriveProductSupplyModel`), not a stored or authored field; the scheduled/dynamic
 * supply rules are enforced at the publish path (`no_future_open_departure`) and the
 * availability path (`dynamic_product_static_availability`), not here. Whether to
 * promote `supplyModel` to a first-class field is tracked in voyant-travel/voyant#2644.
 * See the voyant-travel/platform authoring spec for the canonical per-category rules.
 *
 * Scope: the generic products graph — excursion (`date`/`date_time`), multi-day
 * tour/package (`itinerary`), transfer (`transfer`). Other modes (`stay`,
 * `open`, `other`) pass through leniently in v1.
 */
export function validateProductGraph(spec: ProductGraphSpec): AuthoringIssue[] {
  const issues: AuthoringIssue[] = []
  const mode = spec.product.bookingMode
  const totalDays = spec.itineraries.reduce((n, i) => n + i.days.length, 0)
  const allUnits = spec.options.flatMap((o) => o.units)

  // Every bookable product needs at least one option with a unit.
  if (spec.options.length === 0) {
    issues.push({
      code: "no_options",
      field: "options",
      message: "Product has no options, so it cannot be booked.",
      fix: "Add at least one option with at least one unit.",
    })
  } else if (allUnits.length === 0) {
    issues.push({
      code: "no_units",
      field: "options[].units",
      message: "No option has any units, so there is nothing to price or book.",
      fix: "Add at least one unit (e.g. an 'Adult' person unit) to an option.",
    })
  }

  if (mode === "date" || mode === "date_time") {
    if (totalDays > 1) {
      issues.push({
        code: "excursion_multi_day",
        field: "itineraries",
        message: `A '${mode}' (excursion) product is single-day, but the spec has ${totalDays} itinerary days.`,
        fix: "Use bookingMode 'itinerary' for a multi-day product, or reduce the itinerary to a single day.",
      })
    }
    const roomUnit = allUnits.find((u) => u.unitType === "room")
    if (roomUnit) {
      issues.push({
        code: "excursion_room_unit",
        field: "options[].units[].unitType",
        message: `Excursions price per person, but unit '${roomUnit.name}' has unitType 'room'.`,
        fix: "Set the unit's unitType to 'person', or switch bookingMode to 'stay'/'itinerary' for room-based products.",
      })
    }
  }

  if (mode === "itinerary" && totalDays < 2) {
    issues.push({
      code: "tour_needs_days",
      field: "itineraries",
      message: `A multi-day ('itinerary') product needs at least 2 itinerary days; found ${totalDays}.`,
      fix: "Add itinerary days, or use bookingMode 'date' for a single-day excursion.",
    })
  }

  if (mode === "transfer") {
    if (totalDays > 0) {
      issues.push({
        code: "transfer_no_days",
        field: "itineraries",
        message: `Transfers are point-to-point and take no itinerary days; found ${totalDays}.`,
        fix: "Remove the itinerary days; model the journey via pickup/dropoff pricing instead.",
      })
    }
    const badUnit = allUnits.find((u) => u.unitType !== "vehicle" && u.unitType !== "person")
    if (badUnit) {
      issues.push({
        code: "transfer_unit_type",
        field: "options[].units[].unitType",
        message: `Transfer unit '${badUnit.name}' has unitType '${badUnit.unitType}'; transfers sell per vehicle or per seat.`,
        fix: "Set the unit's unitType to 'vehicle' or 'person'.",
      })
    }
    const hasActiveEndpointRule = spec.options.some((option) =>
      option.priceRules.some(
        (rule) =>
          rule.active &&
          (rule.pickupPriceRules.some((pickupRule) => pickupRule.active) ||
            rule.dropoffPriceRules.some((dropoffRule) => dropoffRule.active)),
      ),
    )
    if (!hasActiveEndpointRule) {
      issues.push({
        code: "transfer_needs_pickup_or_dropoff",
        field: "options[].priceRules[].pickupPriceRules",
        message: "Transfer products require at least one active pickup or dropoff price rule.",
        fix: "Add an active pickupPriceRules[] or dropoffPriceRules[] entry under an active option price rule.",
      })
    }
  }

  return issues
}
