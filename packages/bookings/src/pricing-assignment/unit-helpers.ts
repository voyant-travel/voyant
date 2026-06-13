import type { AssignmentRoleHint, BookingDraftTraveler, PricingAssignmentUnit } from "./types.js"

/**
 * Inventory units are finite containers a traveler is placed into.
 * Rooms (hotels), vehicles (transfers), seats (where modeled
 * explicitly). Distinct from pricing tiers (`person`).
 */
export function optionKey(unit: PricingAssignmentUnit): string {
  return unit.optionId ?? unit.optionUnitId
}

export function isPersonUnit(unit: PricingAssignmentUnit): boolean {
  return unit.unitType == null || unit.unitType === "person"
}

export function isInventoryUnit(unit: PricingAssignmentUnit): boolean {
  return unit.unitType === "room" || unit.unitType === "vehicle"
}

export function roleHintForTraveler(traveler: BookingDraftTraveler): AssignmentRoleHint | null {
  return traveler.role === "adult" || traveler.role === "child" || traveler.role === "infant"
    ? traveler.role
    : null
}
