export type TravelerCategoryRole = "lead" | "adult" | "child" | "infant"

export interface TravelerCategoryState {
  role: TravelerCategoryRole
  roomUnitId: string | null
}

export interface TravelerCategoryUnitState {
  unitId: string
  unitCode: string | null
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
    traveler.roomUnitId === unit.unitId ||
    (traveler.role === "lead" && inferredRole === "adult" && traveler.roomUnitId == null)
  const nextRole = traveler.role === "lead" && inferredRole === "adult" ? "lead" : inferredRole

  return {
    active,
    nextRole,
    shouldUpdate: traveler.roomUnitId !== unit.unitId || traveler.role !== nextRole,
  }
}
