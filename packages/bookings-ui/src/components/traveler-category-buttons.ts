export type TravelerCategoryRole = "lead" | "adult" | "child" | "infant"

export interface TravelerCategoryState {
  role: TravelerCategoryRole
  pricingUnitId: string | null
}

export interface TravelerCategoryUnitState {
  unitId: string
  unitCode: string | null
}

export interface TravelerCategorySelectableUnitState {
  unitType?: string | null
}

export function getSelectableTravelerCategoryUnits<
  TUnit extends TravelerCategorySelectableUnitState,
>(units: readonly TUnit[]): TUnit[] {
  const hasInventoryUnits = units.some(
    (unit) => unit.unitType === "room" || unit.unitType === "vehicle",
  )
  return units.filter(
    (unit) => unit.unitType === "person" || (!hasInventoryUnits && unit.unitType == null),
  )
}

export function shouldUseStaticTravelerCategoryFallback(
  hasGroup: boolean,
  selectableUnitCount: number,
): boolean {
  return !hasGroup || selectableUnitCount === 0
}

export function inferTravelerRoleFromUnit(
  unit: TravelerCategoryUnitState,
): Exclude<TravelerCategoryRole, "lead"> {
  const codeLower = (unit.unitCode ?? "").toLowerCase()
  if (codeLower === "child") return "child"
  if (codeLower === "infant") return "infant"
  return "adult"
}

export function getStaticTravelerCategoryButtonState(
  traveler: TravelerCategoryState,
  category: Exclude<TravelerCategoryRole, "lead">,
): { active: boolean; nextRole: TravelerCategoryRole; shouldUpdate: boolean } {
  const active = traveler.role === category || (traveler.role === "lead" && category === "adult")
  const nextRole = traveler.role === "lead" && category === "adult" ? "lead" : category

  return {
    active,
    nextRole,
    shouldUpdate: traveler.role !== nextRole,
  }
}

export function getDynamicTravelerCategoryButtonState(
  traveler: TravelerCategoryState,
  unit: TravelerCategoryUnitState,
): { active: boolean; nextRole: TravelerCategoryRole; shouldUpdate: boolean } {
  const inferredRole = inferTravelerRoleFromUnit(unit)
  const active =
    traveler.pricingUnitId === unit.unitId ||
    (traveler.role === "lead" && inferredRole === "adult" && traveler.pricingUnitId == null)
  const nextRole = traveler.role === "lead" && inferredRole === "adult" ? "lead" : inferredRole

  return {
    active,
    nextRole,
    shouldUpdate: traveler.pricingUnitId !== unit.unitId || traveler.role !== nextRole,
  }
}
